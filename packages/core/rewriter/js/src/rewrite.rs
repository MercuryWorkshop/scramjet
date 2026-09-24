use oxc::{
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{SmallVec, smallvec};

use crate::changes::{CallReceiver, JsChange, JsChangeType::{CallFnPrelude, LiteralCallFnLeft, LiteralCallFnRight}, change};

macro_rules! rewrite {
    ($span:expr, $($ty:tt)*) => {
		$crate::rewrite::Rewrite::new($span, $crate::rewrite::RewriteType::$($ty)*)
    };
}
pub(crate) use rewrite;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RewriteType<'alloc: 'data, 'data> {
	/// `(cfg.wrapfn(ident))` | `cfg.wrapfn(ident)`
	WrapFn {
		enclose: bool,
	},

	// `new Foo()` -> `new (Foo)()`
	WrapNew,

	/// `(cfg.importfn("cfg.base"))`
	ImportFn,
	/// `cfg.metafn("cfg.base")`
	MetaFn,

	/// `object.method(...args)` ->
	/// `($r = object, cfg.callfn($r, $r.method, ...args))`,
	/// where `$r` is `cfg.tempreceiverid`
	MemberCallFn {
		args: Option<Span>,
		object: Span,
		expression: Span,
		optional: bool,
		computed: bool,
		/// the callee's own `?.`, as in `a.b?.()`
		optional_call: bool,
		/// how many `?.` links the object chain still has to short circuit on,
		/// each of which opens a group this call has to close
		guards: u32,
		/// the callee is a parenthesized chain, so a short circuit calls `undefined`
		throws: bool,
	},
	LiteralCallFn {
		args: Option<Span>,
		inner: Span,
		receiver: CallReceiver,
		/// the call's own `?.`, as in `f?.()`
		optional_call: bool,
	},
	/// `,${cfg.tempreceiverid}==null?void 0:(${cfg.tempreceiverid}=${cfg.tempreceiverid}.`
	ChainGuard {
		computed: bool,
		throws: bool,
	},
	/// `location` -> `$sj_location`
	RewriteProperty {
		ident: Atom<'data>,
	},

	/// `location` -> `$sj_location: location`
	RebindProperty {
		ident: Atom<'data>,
		tempvar: bool,
	},
	// `location` -> `cfg.templocid`
	TempVar,

	WrapObjectAssignment {
		restids: Vec<Atom<'data>>,
		location_assigned: bool,
	},

	/// `cfg.wrapprop({})`
	WrapProperty,

	// dead code only if debug is disabled
	#[allow(dead_code)]
	/// `$scramerr(name)`
	ScramErr {
		ident: Atom<'data>,
	},
	/// `eval(cfg.rewritefn(inner))`
	Eval {
		inner: Span,
	},
	/// `((t)=>$scramjet$tryset(name,"op",t)||(name op t))(rhs)`
	Assignment {
		name: Atom<'data>,
		rhs: Span,
		op: AssignmentOperator,
	},
	/// `ident,` -> `ident: cfg.wrapfn(ident),`
	ShorthandObj {
		name: Atom<'data>,
	},
	SourceTag,

	// ;cfg.cleanrestfn(restids[0]); cfg.cleanrestfn(restid[1]);
	CleanFunction {
		restids: Vec<Atom<'data>>,
		expression: bool,
		location_assigned: bool,
		wrap: bool,
		declare_local_location: bool,
	},
	/// `var location = ...` -> `var cfg.temploc = ..., cfg.tempunused = (cfg.cleanrestfn(restids[0]),cfg.trysetfn(location,"=",cfg.temploc)||location=cfg.temploc)`
	CleanVariableDeclaration {
		restids: Vec<Atom<'data>>,
		location_assigned: bool,
		declare_local_location: bool,
	},

	/// `.` -> `?.`, `[` -> `?.[`, `(` -> `?.(`: the link after a stamped call that can short circuit, which the
	/// call's rewrite has taken out of the chain
	OptionalLink {
		opener: &'static str,
	},

	// don't use for anything static, only use for stuff like rewriteurl
	Replace {
		text: &'alloc str,
	},
	Delete,
}

#[derive(Debug)]
pub(crate) struct Rewrite<'alloc, 'data> {
	span: Span,
	ty: RewriteType<'alloc, 'data>,
}

impl<'alloc: 'data, 'data> Rewrite<'alloc, 'data> {
	pub fn new(span: Span, ty: RewriteType<'alloc, 'data>) -> Self {
		Self { span, ty }
	}

	pub fn into_inner(self) -> SmallVec<[JsChange<'alloc, 'data>; 2]> {
		self.ty.into_inner(self.span)
	}
}

impl<'alloc: 'data, 'data> RewriteType<'alloc, 'data> {
	fn into_inner(self, span: Span) -> SmallVec<[JsChange<'alloc, 'data>; 2]> {
		macro_rules! span {
			(start) => {
				Span::new(span.start, span.start)
			};
			(end) => {
				Span::new(span.end, span.end)
			};
			($span1:ident $span2:ident start) => {
				Span::new($span1.start, $span2.start)
			};
			($span1:ident $span2:ident end) => {
				Span::new($span1.end, $span2.end)
			};
			($span1:ident $span2:ident between) => {
				Span::new($span1.end, $span2.start)
			};
		}

		match self {
			Self::WrapFn { enclose } => smallvec![
				change!(span!(start), WrapFnLeft { enclose }),
				change!(span!(end), WrapFnRight { enclose }),
			],
			Self::RewriteProperty { ident } => smallvec![change!(span, RewriteProperty { ident }),],
			Self::RebindProperty { ident, tempvar } => {
				smallvec![change!(span, RebindProperty { ident, tempvar })]
			}
			Self::TempVar => smallvec![change!(span, TempVar)],
			Self::WrapProperty => smallvec![
				change!(span!(start), WrapPropertyLeft),
				change!(span!(end), WrapPropertyRight),
			],
			Self::WrapObjectAssignment {
				restids,
				location_assigned,
			} => smallvec![
				change!(
					span!(start),
					WrapObjectAssignmentLeft {
						restids,
						location_assigned
					}
				),
				change!(
					span!(end),
					ClosingParen {
						semi: false,
						replace: false
					}
				)
			],
			Self::CleanFunction {
				restids,
				expression,
				location_assigned,
				wrap,
				declare_local_location,
			} => {
				if expression {
					smallvec![
						change!(
							Span::new(span.start, span.start),
							CleanFunction {
								restids,
								expression,
								location_assigned,
								wrap,
								declare_local_location
							}
						),
						change!(
							Span::new(span.end, span.end),
							ClosingParen {
								semi: false,
								replace: false
							}
						)
					]
				} else if wrap {
					smallvec![
						change!(
							Span::new(span.start, span.start),
							CleanFunction {
								restids,
								expression,
								location_assigned,
								wrap,
								declare_local_location
							}
						),
						change!(
							span!(end),
							ClosingBrace {
								semi: false,
								replace: false
							}
						)
					]
				} else {
					smallvec![change!(
						Span::new(span.start, span.start),
						CleanFunction {
							restids,
							expression,
							location_assigned,
							wrap,
							declare_local_location
						}
					)]
				}
			}
			Self::CleanVariableDeclaration {
				restids,
				location_assigned,
				declare_local_location,
			} => smallvec![change!(
				span!(end),
				CleanVariableDeclaration {
					restids,
					location_assigned,
					declare_local_location
				}
			)],
			Self::WrapNew => smallvec![change!(span!(start), OpeningParen), change!(span!(end), ClosingParen { semi: false, replace: false })],
			Self::MemberCallFn { args, object, expression, optional, computed, optional_call, guards, throws } => {
				// the prelude reaches from the call to the object rather than
				// sitting at the call's start, so that the parens of a
				// `(a.b)()` are consumed by it instead of being left behind
				let mut out: SmallVec<[JsChange; 2]> = smallvec![
					change!(span!(span object start), CallFnPrelude),
					change!(span!(object expression between), CallFnLeft { optional, computed, optional_call, throws }),
				];

				// one group per guard, one for the prelude, and - when there
				// are no arguments - one for the call whose own parens the
				// right hand side has just eaten
				let mut closing = guards + 1;
				match &args {
					Some(ar) => out.push(change!(span!(expression ar between), CallFnRight { computed, optional_call })),
					None => {
						out.push(change!(span!(expression span end), CallFnRight { computed, optional_call }));
						closing += 1;
					}
				}
				if optional && optional_call {
					closing += 1;
				}
				for _ in 0..closing {
					out.push(change!(span!(span span end), ClosingParen { semi: false, replace: false }));
				}

				out
			}
			Self::ChainGuard { computed, throws } => smallvec![change!(span, ChainGuard { computed, throws })],
			Self::LiteralCallFn { args, inner, receiver, optional_call } => {
				let mut out: SmallVec<[JsChange; 2]> =
					smallvec![change!(span!(start), LiteralCallFnLeft { receiver, optional_call })];

				match (&args, optional_call) {
					(Some(ar), false) => out.push(change!(span!(inner ar between), Replace { text: "," })),
					(None, false) => out.push(change!(
						span!(inner span end),
						ClosingParen { semi: false, replace: true }
					)),
					// parking the callee opens a group of its own, and with no
					// arguments the call's parens have been eaten along with it
					(Some(ar), true) => {
						out.push(change!(span!(inner ar between), LiteralCallFnRight { receiver }));
						out.push(change!(span!(span span end), ClosingParen { semi: false, replace: false }));
					}
					(None, true) => {
						out.push(change!(span!(inner span end), LiteralCallFnRight { receiver }));
						out.push(change!(span!(span span end), ClosingParen { semi: false, replace: false }));
						out.push(change!(span!(span span end), ClosingParen { semi: false, replace: false }));
					}
				}

				out
			}
			Self::ImportFn => smallvec![change!(span, ImportFn)],
			Self::MetaFn => smallvec![change!(span, MetaFn)],
			Self::ScramErr { ident } => smallvec![change!(span!(end), ScramErrFn { ident })],
			Self::Eval { inner } => smallvec![
				change!(Span::new(inner.start, inner.start), EvalRewriteFn),
				change!(
					Span::new(inner.end, inner.end),
					ClosingParen {
						semi: false,
						replace: false,
					}
				)
			],
			Self::Assignment { name, rhs, op } => smallvec![
				change!(span!(span rhs start), AssignmentLeft { name, op }),
				change!(
					span!(rhs span end),
					ClosingParen {
						semi: false,
						replace: true
					}
				)
			],
			Self::ShorthandObj { name } => {
				smallvec![change!(span!(end), ShorthandObj { ident: name })]
			}
			Self::SourceTag => smallvec![change!(span, SourceTag)],
			Self::OptionalLink { opener } => smallvec![change!(span, Replace { text: opener })],
			Self::Replace { text } => smallvec![change!(span, Replace { text })],
			Self::Delete => smallvec![change!(span, Delete)],
		}
	}
}

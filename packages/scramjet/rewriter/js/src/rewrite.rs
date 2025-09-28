use oxc::{
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{SmallVec, smallvec};

use crate::changes::{JsChange, change};

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
	/// `cfg.setrealmfn({}).ident`
	SetRealmFn,

	/// `(cfg.importfn("cfg.base"))`
	ImportFn,
	/// `cfg.metafn("cfg.base")`
	MetaFn,

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
	/// `$scramitize(span)`
	Scramitize,

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
	},
	/// `var location = ...` -> `var cfg.temploc = ..., cfg.tempunused = (cfg.cleanrestfn(restids[0]),cfg.trysetfn(location,"=",cfg.temploc)||location=cfg.temploc)`
	CleanVariableDeclaration {
		restids: Vec<Atom<'data>>,
		location_assigned: bool,
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
			} => {
				if expression {
					smallvec![
						change!(
							Span::new(span.start, span.start),
							CleanFunction {
								restids,
								expression,
								location_assigned,
								wrap
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
								wrap
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
							wrap
						}
					)]
				}
			}
			Self::CleanVariableDeclaration {
				restids,
				location_assigned,
			} => smallvec![change!(
				span!(end),
				CleanVariableDeclaration {
					restids,
					location_assigned
				}
			)],
			Self::SetRealmFn => smallvec![change!(span, SetRealmFn)],
			Self::ImportFn => smallvec![change!(span, ImportFn)],
			Self::MetaFn => smallvec![change!(span, MetaFn)],
			Self::ScramErr { ident } => smallvec![change!(span!(end), ScramErrFn { ident })],
			Self::Scramitize => smallvec![
				change!(span!(start), ScramitizeFn),
				change!(
					span!(end),
					ClosingParen {
						semi: false,
						replace: false
					}
				)
			],
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
			Self::Replace { text } => smallvec![change!(span, Replace { text })],
			Self::Delete => smallvec![change!(span, Delete)],
		}
	}
}

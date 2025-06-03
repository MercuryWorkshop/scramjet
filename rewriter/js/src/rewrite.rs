use oxc::{ast::ast::AssignmentOperator, span::{Atom, Span}};
use smallvec::{smallvec, SmallVec};

use crate::changes::JsChange;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Rewrite<'alloc: 'data, 'data> {
	/// `(cfg.wrapfn(ident,strictchecker))` | `cfg.wrapfn(ident,strictchecker)`
	WrapFn {
		span: Span,
		wrapped: bool,
	},
	/// `cfg.setrealmfn({}).ident`
	SetRealmFn {
		span: Span,
	},
	/// `cfg.wrapthis(this)`
	WrapThisFn {
		span: Span,
	},
	/// `(cfg.importfn("cfg.base"))`
	ImportFn {
		span: Span,
	},
	/// `cfg.metafn("cfg.base")`
	MetaFn {
		span: Span,
	},

	// dead code only if debug is disabled
	#[allow(dead_code)]
	/// `$scramerr(name)`
	ScramErr {
		span: Span,
		ident: Atom<'data>,
	},
	/// `$scramitize(span)`
	Scramitize {
		span: Span,
	},

	/// `eval(cfg.rewritefn(inner))`
	Eval {
		span: Span,
		inner: Span,
	},
	/// `((t)=>$scramjet$tryset(name,"op",t)||(name op t))(rhsspan)`
	Assignment {
		name: Atom<'data>,
		entirespan: Span,
		rhsspan: Span,
		op: AssignmentOperator,
	},
	/// `ident,` -> `ident: cfg.wrapfn(ident),`
	ShorthandObj {
		span: Span,
		name: Atom<'data>,
	},
	SourceTag {
		span: Span,
	},

	// don't use for anything static, only use for stuff like rewriteurl
	Replace {
		span: Span,
		text: &'alloc str,
	},
	Delete {
		span: Span,
	},
}

impl<'alloc: 'data, 'data> Rewrite<'alloc, 'data> {
	pub fn into_inner(self) -> SmallVec<[JsChange<'alloc, 'data>; 2]> {
		match self {
			Self::WrapFn {
				wrapped: extra,
				span,
			} => {
				let start = Span::new(span.start, span.start);
				let end = Span::new(span.end, span.end);

				smallvec![
					JsChange::WrapFnLeft { span: start, extra },
					JsChange::WrapFnRight { span: end, extra }
				]
			}
			Self::SetRealmFn { span } => smallvec![JsChange::SetRealmFn { span }],
			Self::WrapThisFn { span } => smallvec![
				JsChange::WrapThisFn {
					span: Span::new(span.start, span.start)
				},
				JsChange::ClosingParen {
					span: Span::new(span.end, span.end),
					semi: false,
				}
			],
			Self::ImportFn { span } => smallvec![JsChange::ImportFn { span }],
			Self::MetaFn { span } => smallvec![JsChange::MetaFn { span }],

			Self::ScramErr { span, ident } => {
				smallvec![JsChange::ScramErrFn {
					span: Span::new(span.start, span.start),
					ident,
				},]
			}
			Self::Scramitize { span } => {
				smallvec![
					JsChange::ScramitizeFn {
						span: Span::new(span.start, span.start)
					},
					JsChange::ClosingParen {
						span: Span::new(span.end, span.end),
						semi: false,
					}
				]
			}

			Self::Eval { inner, span } => smallvec![
				JsChange::EvalRewriteFn {
					span: Span::new(span.start, inner.start)
				},
				JsChange::ReplaceClosingParen {
					span: Span::new(inner.end, span.end),
				}
			],
			Self::Assignment {
				name,
				rhsspan,
				op,
				entirespan,
			} => smallvec![
				JsChange::AssignmentLeft {
					name,
					op,
					span: Span::new(entirespan.start, rhsspan.start)
				},
				JsChange::ReplaceClosingParen {
					span: Span::new(rhsspan.end, entirespan.end)
				}
			],
			// maps to insert
			Self::ShorthandObj { name, span } => smallvec![JsChange::ShorthandObj {
				ident: name,
				span: Span::new(span.end, span.end)
			}],
			// maps to insert
			Self::SourceTag { span } => smallvec![JsChange::SourceTag { span }],
			Self::Replace { text, span } => smallvec![JsChange::Replace { span, text }],
			Self::Delete { span } => smallvec![JsChange::Delete { span }],
		}
	}
}

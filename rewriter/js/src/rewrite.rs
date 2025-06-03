use oxc::{
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::changes::{JsChange, JsChangeType};

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
				wrapped: wrap,
				span,
			} => {
				let start = Span::new(span.start, span.start);
				let end = Span::new(span.end, span.end);

				smallvec![
					JsChange::new(start, JsChangeType::WrapFnLeft { wrap }),
					JsChange::new(end, JsChangeType::WrapFnRight { wrap }),
				]
			}
			Self::SetRealmFn { span } => smallvec![JsChange::new(span, JsChangeType::SetRealmFn)],
			Self::WrapThisFn { span } => smallvec![
				JsChange::new(Span::new(span.start, span.start), JsChangeType::WrapThisFn),
				JsChange::new(
					Span::new(span.end, span.end),
					JsChangeType::ClosingParen { semi: false }
				),
			],
			Self::ImportFn { span } => smallvec![JsChange::new(span, JsChangeType::ImportFn)],
			Self::MetaFn { span } => smallvec![JsChange::new(span, JsChangeType::MetaFn)],

			Self::ScramErr { span, ident } => {
				smallvec![JsChange::new(
					Span::new(span.start, span.start),
					JsChangeType::ScramErrFn { ident }
				)]
			}
			Self::Scramitize { span } => {
				smallvec![
					JsChange::new(
						Span::new(span.start, span.start),
						JsChangeType::ScramitizeFn
					),
					JsChange::new(
						Span::new(span.end, span.end),
						JsChangeType::ClosingParen { semi: false }
					)
				]
			}

			Self::Eval { inner, span } => smallvec![
				JsChange::new(
					Span::new(span.start, inner.start),
					JsChangeType::EvalRewriteFn,
				),
				JsChange::new(
					Span::new(inner.end, span.end),
					JsChangeType::ReplaceClosingParen,
				)
			],
			Self::Assignment {
				name,
				rhsspan,
				op,
				entirespan,
			} => smallvec![
				JsChange::new(
					Span::new(entirespan.start, rhsspan.start),
					JsChangeType::AssignmentLeft { name, op }
				),
				JsChange::new(
					Span::new(rhsspan.end, entirespan.end),
					JsChangeType::ReplaceClosingParen,
				)
			],
			Self::ShorthandObj { name, span } => smallvec![JsChange::new(
				Span::new(span.end, span.end),
				JsChangeType::ShorthandObj { ident: name }
			)],
			Self::SourceTag { span } => smallvec![JsChange::new(span, JsChangeType::SourceTag)],
			Self::Replace { text, span } => {
				smallvec![JsChange::new(span, JsChangeType::Replace { text })]
			}
			Self::Delete { span } => smallvec![JsChange::new(span, JsChangeType::Delete)],
		}
	}
}

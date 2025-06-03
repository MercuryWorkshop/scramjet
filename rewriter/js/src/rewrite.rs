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
		span: Span,
		rhs: Span,
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

macro_rules! span {
	($span:ident start) => {
		Span::new($span.start, $span.start)
	};
	($span:ident end) => {
		Span::new($span.end, $span.end)
	};
	($span1:ident $span2:ident start) => {
		Span::new($span1.start, $span2.start)
	};
	($span1:ident $span2:ident end) => {
		Span::new($span1.end, $span2.end)
	};
}

impl<'alloc: 'data, 'data> Rewrite<'alloc, 'data> {
	pub fn into_inner(self) -> SmallVec<[JsChange<'alloc, 'data>; 2]> {
		use JsChangeType as Ty;
		match self {
			Self::WrapFn {
				wrapped: wrap,
				span,
			} => smallvec![
				JsChange::new(span!(span start), Ty::WrapFnLeft { wrap }),
				JsChange::new(span!(span end), Ty::WrapFnRight { wrap }),
			],
			Self::SetRealmFn { span } => smallvec![JsChange::new(span, Ty::SetRealmFn)],
			Self::WrapThisFn { span } => smallvec![
				JsChange::new(span!(span start), Ty::WrapThisFn),
				JsChange::new(span!(span end), Ty::ClosingParen { semi: false }),
			],
			Self::ImportFn { span } => smallvec![JsChange::new(span, Ty::ImportFn)],
			Self::MetaFn { span } => smallvec![JsChange::new(span, Ty::MetaFn)],

			Self::ScramErr { span, ident } => {
				smallvec![JsChange::new(span!(span end), Ty::ScramErrFn { ident })]
			}
			Self::Scramitize { span } => {
				smallvec![
					JsChange::new(span!(span start), Ty::ScramitizeFn),
					JsChange::new(span!(span end), Ty::ClosingParen { semi: false })
				]
			}

			Self::Eval { inner, span } => smallvec![
				JsChange::new(span!(span inner start), Ty::EvalRewriteFn),
				JsChange::new(span!(inner span end), Ty::ReplaceClosingParen)
			],
			Self::Assignment {
				name,
				rhs,
				op,
				span,
			} => smallvec![
				JsChange::new(span!(span rhs start), Ty::AssignmentLeft { name, op }),
				JsChange::new(span!(rhs span end), Ty::ReplaceClosingParen)
			],
			Self::ShorthandObj { name, span } => smallvec![JsChange::new(
				span!(span end),
				Ty::ShorthandObj { ident: name }
			)],
			Self::SourceTag { span } => smallvec![JsChange::new(span, Ty::SourceTag)],
			Self::Replace { text, span } => {
				smallvec![JsChange::new(span, Ty::Replace { text })]
			}
			Self::Delete { span } => smallvec![JsChange::new(span, Ty::Delete)],
		}
	}
}

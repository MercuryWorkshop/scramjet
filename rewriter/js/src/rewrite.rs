use oxc::{
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::changes::{JsChange, JsChangeType};

macro_rules! rewrite {
    ($span:expr, $($ty:tt)*) => {
		$crate::rewrite::Rewrite::new($span, $crate::rewrite::RewriteType::$($ty)*)
    };
}
pub(crate) use rewrite;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RewriteType<'alloc: 'data, 'data> {
	/// `(cfg.wrapfn(ident,strictchecker))` | `cfg.wrapfn(ident,strictchecker)`
	WrapFn {
		wrapped: bool,
	},
	/// `cfg.setrealmfn({}).ident`
	SetRealmFn,
	/// `cfg.wrapthis(this)`
	WrapThisFn,
	/// `(cfg.importfn("cfg.base"))`
	ImportFn,
	/// `cfg.metafn("cfg.base")`
	MetaFn,

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

	// don't use for anything static, only use for stuff like rewriteurl
	Replace {
		text: &'alloc str,
	},
	Delete,
}

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
		}

		use JsChangeType as Ty;
		match self {
			Self::WrapFn { wrapped: wrap } => smallvec![
				JsChange::new(span!(start), Ty::WrapFnLeft { wrap }),
				JsChange::new(span!(end), Ty::WrapFnRight { wrap }),
			],
			Self::SetRealmFn => smallvec![JsChange::new(span, Ty::SetRealmFn)],
			Self::WrapThisFn => smallvec![
				JsChange::new(span!(start), Ty::WrapThisFn),
				JsChange::new(span!(end), Ty::ClosingParen { semi: false }),
			],
			Self::ImportFn => smallvec![JsChange::new(span, Ty::ImportFn)],
			Self::MetaFn => smallvec![JsChange::new(span, Ty::MetaFn)],

			Self::ScramErr { ident } => {
				smallvec![JsChange::new(span!(end), Ty::ScramErrFn { ident })]
			}
			Self::Scramitize => {
				smallvec![
					JsChange::new(span!(start), Ty::ScramitizeFn),
					JsChange::new(span!(end), Ty::ClosingParen { semi: false })
				]
			}

			Self::Eval { inner } => smallvec![
				JsChange::new(span!(span inner start), Ty::EvalRewriteFn),
				JsChange::new(span!(inner span end), Ty::ReplaceClosingParen)
			],
			Self::Assignment { name, rhs, op } => smallvec![
				JsChange::new(span!(span rhs start), Ty::AssignmentLeft { name, op }),
				JsChange::new(span!(rhs span end), Ty::ReplaceClosingParen)
			],
			Self::ShorthandObj { name } => {
				smallvec![JsChange::new(span!(end), Ty::ShorthandObj { ident: name })]
			}
			Self::SourceTag => smallvec![JsChange::new(span, Ty::SourceTag)],
			Self::Replace { text } => {
				smallvec![JsChange::new(span, Ty::Replace { text })]
			}
			Self::Delete => smallvec![JsChange::new(span, Ty::Delete)],
		}
	}
}

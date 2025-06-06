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
	/// `(cfg.wrapfn(ident,strictchecker))` | `cfg.wrapfn(ident,strictchecker)`
	WrapFn {
		wrap: bool,
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

		match self {
			Self::WrapFn { wrap } => smallvec![
				change!(span!(start), WrapFnLeft { wrap }),
				change!(span!(end), WrapFnRight { wrap }),
			],
			Self::SetRealmFn => smallvec![change!(span, SetRealmFn)],
			Self::WrapThisFn => smallvec![
				change!(span!(start), WrapThisFn),
				change!(
					span!(end),
					ClosingParen {
						semi: false,
						replace: false
					}
				),
			],
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
				change!(span!(span inner start), EvalRewriteFn),
				change!(
					span!(inner span end),
					ClosingParen {
						semi: false,
						replace: true
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

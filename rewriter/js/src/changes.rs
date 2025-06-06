use std::cmp::Ordering;

use oxc::{
	allocator::Allocator,
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{SmallVec, smallvec};
use transform::{
	TransformResult, Transformer,
	transform::{Transform, TransformLL},
};

use crate::{
	RewriterError,
	cfg::{Config, Flags},
	rewrite::Rewrite,
};

// const STRICTCHECKER: &str = "(function(a){arguments[0]=false;return a})(true)";
const STRICTCHECKER: &str = "(function(){return!this;})()";

macro_rules! change {
    ($span:expr, $($ty:tt)*) => {
		$crate::changes::JsChange::new($span, $crate::changes::JsChangeType::$($ty)*)
    };
}
pub(crate) use change;

macro_rules! changes {
	[] => { SmallVec::new() };
	[$($change:expr),+] => {
		smallvec![$(transform::transform::TransformElement::from($change)),+]
    };
}

#[derive(Debug, PartialEq, Eq)]
pub enum JsChangeType<'alloc: 'data, 'data> {
	/// insert `${cfg.wrapfn}(`
	WrapFnLeft { wrap: bool },
	/// insert `,strictchecker)`
	WrapFnRight { wrap: bool },
	/// insert `${cfg.setrealmfn}({}).`
	SetRealmFn,
	/// insert `${cfg.wrapthis}(`
	WrapThisFn,
	/// insert `$scramerr(ident);`
	ScramErrFn { ident: Atom<'data> },
	/// insert `$scramitize(`
	ScramitizeFn,
	/// insert `eval(${cfg.rewritefn}(`
	EvalRewriteFn,
	/// insert `: ${cfg.wrapfn}(ident)`
	ShorthandObj { ident: Atom<'data> },
	/// insert scramtag
	SourceTag,

	/// replace span with `${cfg.importfn}`
	ImportFn,
	/// replace span with `${cfg.metafn}("${cfg.base}")`
	MetaFn,
	/// replace span with `((t)=>$scramjet$tryset(${name},"${op}",t)||(${name}${op}t))(`
	AssignmentLeft {
		name: Atom<'data>,
		op: AssignmentOperator,
	},

	/// insert `)`
	ClosingParen { semi: bool, replace: bool },

	/// replace span with text
	Replace { text: &'alloc str },
	/// replace span with ""
	Delete,
}

#[derive(Debug, PartialEq, Eq)]
pub struct JsChange<'alloc: 'data, 'data> {
	pub span: Span,
	pub ty: JsChangeType<'alloc, 'data>,
}

impl<'alloc: 'data, 'data> JsChange<'alloc, 'data> {
	pub fn new(span: Span, ty: JsChangeType<'alloc, 'data>) -> Self {
		Self { span, ty }
	}
}

impl<'alloc: 'data, 'data> Transform for JsChange<'alloc, 'data> {
	type ToLowLevelData = (&'data Config, &'data Flags);

	fn span(&self) -> Span {
		self.span
	}

	fn into_low_level(self, (cfg, flags): &Self::ToLowLevelData, cursor: u32) -> TransformLL<'_> {
		use JsChangeType as Ty;
		use TransformLL as LL;
		match self.ty {
			Ty::WrapFnLeft { wrap } => LL::insert(if wrap {
				changes!["(", &cfg.wrapfn, "("]
			} else {
				changes![&cfg.wrapfn, "("]
			}),
			Ty::WrapFnRight { wrap } => LL::insert(if wrap {
				changes![",", STRICTCHECKER, "))"]
			} else {
				changes![",", STRICTCHECKER, ")"]
			}),
			Ty::SetRealmFn => LL::insert(changes![&cfg.setrealmfn, "({})."]),
			Ty::WrapThisFn => LL::insert(changes![&cfg.wrapthisfn, "("]),
			Ty::ScramErrFn { ident } => LL::insert(changes!["$scramerr(", ident, ");"]),
			Ty::ScramitizeFn => LL::insert(changes![" $scramitize("]),
			Ty::EvalRewriteFn => LL::replace(changes!["eval(", &cfg.rewritefn, "("]),
			Ty::ShorthandObj { ident } => LL::insert(changes![":", &cfg.wrapfn, "(", ident, ")"]),
			Ty::SourceTag => LL::insert(changes![
				"/*scramtag ",
				self.span.start + cursor,
				" ",
				&flags.sourcetag,
				"*/"
			]),
			Ty::ImportFn => LL::replace(changes![&cfg.importfn, "(\"", &flags.base, "\","]),
			Ty::MetaFn => LL::replace(changes![&cfg.metafn, "(\"", &flags.base, "\")"]),
			Ty::AssignmentLeft { name, op } => LL::replace(changes![
				"((t)=>$scramjet$tryset(",
				name,
				",\"",
				op,
				"\",t)||(",
				name,
				op,
				"t))("
			]),
			Ty::ClosingParen { semi, replace } => {
				let vec = if semi { changes![");"] } else { changes![")"] };

				if replace {
					LL::replace(vec)
				} else {
					LL::insert(vec)
				}
			}
			Ty::Replace { text } => LL::replace(changes![text]),
			Ty::Delete => LL::replace(changes![]),
		}
	}
}

impl PartialOrd for JsChange<'_, '_> {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for JsChange<'_, '_> {
	fn cmp(&self, other: &Self) -> std::cmp::Ordering {
		use JsChangeType as Ty;

		match self.span.start.cmp(&other.span.start) {
			Ordering::Equal => match (&self.ty, &other.ty) {
				(Ty::ScramErrFn { .. }, _) => Ordering::Less,
				(_, Ty::ScramErrFn { .. }) => Ordering::Greater,
				_ => Ordering::Equal,
			},
			x => x,
		}
	}
}

pub(crate) struct JsChanges<'alloc: 'data, 'data> {
	inner: Transformer<'alloc, JsChange<'alloc, 'data>>,
}

impl<'alloc: 'data, 'data> JsChanges<'alloc, 'data> {
	#[inline]
	pub fn new() -> Self {
		Self {
			inner: Transformer::new(),
		}
	}

	#[inline]
	pub fn add(&mut self, rewrite: Rewrite<'alloc, 'data>) {
		self.inner.add(rewrite.into_inner());
	}

	#[inline]
	pub fn set_alloc(&mut self, alloc: &'alloc Allocator) -> Result<(), RewriterError> {
		Ok(self.inner.set_alloc(alloc)?)
	}

	#[inline]
	pub fn take_alloc(&mut self) -> Result<(), RewriterError> {
		Ok(self.inner.take_alloc()?)
	}

	#[inline]
	pub fn empty(&self) -> bool {
		self.inner.empty()
	}

	#[inline]
	pub fn perform(
		&mut self,
		js: &'data str,
		cfg: &'data Config,
		flags: &'data Flags,
	) -> Result<TransformResult<'alloc>, RewriterError> {
		Ok(self.inner.perform(js, &(cfg, flags))?)
	}
}

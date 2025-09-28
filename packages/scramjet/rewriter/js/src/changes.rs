use std::cmp::Ordering;

use oxc::{
	allocator::Allocator,
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use transform::{
	TransformResult, Transformer,
	transform::{Transform, TransformLL},
	transforms,
};

use crate::{
	RewriterError,
	cfg::{Config, Flags},
	rewrite::Rewrite,
};

macro_rules! change {
    ($span:expr, $($ty:tt)*) => {
		$crate::changes::JsChange::new($span, $crate::changes::JsChangeType::$($ty)*)
    };
}
pub(crate) use change;

#[derive(Debug, PartialEq, Eq)]
pub enum JsChangeType<'alloc: 'data, 'data> {
	/// insert `${cfg.wrapfn}(`
	WrapFnLeft {
		enclose: bool,
	},
	/// insert `)`
	WrapFnRight {
		enclose: bool,
	},

	WrapPropertyLeft,
	WrapPropertyRight,
	RewriteProperty {
		ident: Atom<'data>,
	},
	RebindProperty {
		ident: Atom<'data>,
		tempvar: bool,
	},
	TempVar,

	WrapObjectAssignmentLeft {
		restids: Vec<Atom<'data>>,
		location_assigned: bool,
	},

	/// insert `${cfg.setrealmfn}({}).`
	SetRealmFn,
	/// insert `$scramerr(ident);`
	ScramErrFn {
		ident: Atom<'data>,
	},
	/// insert `$scramitize(`
	ScramitizeFn,
	/// insert `eval(${cfg.rewritefn}(`
	EvalRewriteFn,
	/// insert `: ${cfg.wrapfn}(ident)`
	ShorthandObj {
		ident: Atom<'data>,
	},
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
	ClosingParen {
		semi: bool,
		replace: bool,
	},
	/// insert `}`
	ClosingBrace {
		semi: bool,
		replace: bool,
	},

	/// replace span with text
	Replace {
		text: &'alloc str,
	},
	/// replace span with ""
	Delete,
	// ;cfg.cleanrestfn(restids[0]); cfg.cleanrestfn(restids[1]);
	// or
	// (cfg.cleanrestfn(restids[0]), cfg.cleanrestfn(restids[1]),
	CleanFunction {
		restids: Vec<Atom<'data>>,
		expression: bool,
		location_assigned: bool,
		wrap: bool,
	},
	CleanVariableDeclaration {
		restids: Vec<Atom<'data>>,
		location_assigned: bool,
	},
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

impl<'alloc: 'data, 'data> Transform<'data> for JsChange<'alloc, 'data> {
	type ToLowLevelData = (&'data Config, &'data Flags);

	fn span(&self) -> Span {
		self.span
	}

	fn into_low_level(
		self,
		(cfg, flags): &Self::ToLowLevelData,
		offset: i32,
	) -> TransformLL<'data> {
		use JsChangeType as Ty;
		use TransformLL as LL;
		match self.ty {
			Ty::WrapFnLeft { enclose } => LL::insert(if enclose {
				transforms!["(", &cfg.wrapfn, "("]
			} else {
				transforms![&cfg.wrapfn, "("]
			}),
			Ty::WrapFnRight { enclose } => LL::insert(if enclose {
				transforms!["))"]
			} else {
				transforms![")"]
			}),
			Ty::WrapPropertyLeft => LL::insert(transforms![&cfg.wrappropertyfn, "(("]),
			Ty::WrapPropertyRight => LL::insert(transforms!["))"]),
			Ty::RewriteProperty { ident } => LL::replace(transforms![&cfg.wrappropertybase, ident]),
			Ty::RebindProperty { ident, tempvar } => {
				if tempvar {
					LL::replace(transforms![
						&cfg.wrappropertybase,
						ident,
						":",
						&cfg.templocid
					])
				} else {
					LL::replace(transforms![&cfg.wrappropertybase, ident, ":", ident])
				}
			}
			Ty::TempVar => LL::replace(transforms![&cfg.templocid]),
			Ty::WrapObjectAssignmentLeft {
				restids,
				location_assigned,
			} => {
				let mut steps = String::new();
				for id in restids {
					steps.push_str(&format!("{}({}),", &cfg.cleanrestfn, id.as_str()));
				}
				if location_assigned {
					steps.push_str(&format!(
						"{}(location,\"=\",{})||(location={}),",
						&cfg.trysetfn, &cfg.templocid, &cfg.templocid
					));
				}
				let steps: &'static str = Box::leak(steps.into_boxed_str());
				LL::insert(transforms!["((t)=>(", &steps, "t))("])
			}
			Ty::CleanFunction {
				restids,
				expression,
				location_assigned,
				wrap,
			} => {
				let mut steps = String::new();

				if expression {
					for id in restids {
						steps.push_str(&format!("{}({}),", &cfg.cleanrestfn, id.as_str()));
					}
					if location_assigned {
						steps.push_str(&format!(
							"{}(location,\"=\",{})||(location={}),",
							&cfg.trysetfn, &cfg.templocid, &cfg.templocid
						));
					}
					let steps: &'static str = Box::leak(steps.into_boxed_str());
					LL::insert(transforms!["(", &steps])
				} else {
					for id in restids {
						steps.push_str(&format!("{}({});", &cfg.cleanrestfn, id.as_str()));
					}
					if location_assigned {
						steps.push_str(&format!(
							"{}(location,\"=\",{})||(location={});",
							&cfg.trysetfn, &cfg.templocid, &cfg.templocid
						));
					}
					let steps: &'static str = Box::leak(steps.into_boxed_str());
					if wrap {
						LL::insert(transforms!["{", &steps])
					} else {
						LL::insert(transforms![";", &steps])
					}
				}
			}
			Ty::CleanVariableDeclaration {
				restids,
				location_assigned,
			} => {
				let mut steps = String::new();
				for id in restids {
					steps.push_str(&format!("{}({}),", &cfg.cleanrestfn, id.as_str()));
				}
				if location_assigned {
					steps.push_str(&format!(
						"{}(location,\"=\",{})||(location={}),",
						&cfg.trysetfn, &cfg.templocid, &cfg.templocid
					));
				}
				let steps: &'static str = Box::leak(steps.into_boxed_str());
				LL::insert(transforms![",", &cfg.tempunusedid, "=(", &steps, "0)"])
			}
			Ty::SetRealmFn => LL::insert(transforms![&cfg.setrealmfn, "({})."]),
			Ty::ScramErrFn { ident } => LL::insert(transforms!["$scramerr(", ident, ");"]),
			Ty::ScramitizeFn => LL::insert(transforms![" $scramitize("]),
			Ty::EvalRewriteFn => LL::insert(transforms![&cfg.rewritefn, "("]),
			Ty::ShorthandObj { ident } => {
				LL::insert(transforms![":", &cfg.wrapfn, "(", ident, ")"])
			}
			Ty::SourceTag => LL::insert(transforms![
				"/*scramtag ",
				self.span.start.wrapping_add_signed(offset),
				" ",
				&flags.sourcetag,
				"*/"
			]),
			Ty::ImportFn => LL::replace(transforms![&cfg.importfn, "(\"", &flags.base, "\","]),
			Ty::MetaFn => LL::replace(transforms![&cfg.metafn, "(import.meta,\"", &flags.base, "\")"]),
			Ty::AssignmentLeft { name, op } => LL::replace(transforms![
				"((t)=>",
				&cfg.trysetfn,
				"(",
				name,
				",\"",
				op,
				"\",t)||(",
				name,
				op,
				"t))("
			]),
			Ty::ClosingParen { semi, replace } => {
				let vec = if semi {
					transforms![");"]
				} else {
					transforms![")"]
				};

				if replace {
					LL::replace(vec)
				} else {
					LL::insert(vec)
				}
			}
			Ty::ClosingBrace { semi, replace } => {
				let vec = if semi {
					transforms!["};"]
				} else {
					transforms!["}"]
				};

				if replace {
					LL::replace(vec)
				} else {
					LL::insert(vec)
				}
			}
			Ty::Replace { text } => LL::replace(transforms![text]),
			Ty::Delete => LL::replace(transforms![]),
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
				(Ty::WrapFnRight { .. }, _) => Ordering::Less,
				(_, Ty::WrapFnRight { .. }) => Ordering::Greater,
				_ => Ordering::Equal,
			},
			x => x,
		}
	}
}

pub(crate) struct JsChanges<'alloc: 'data, 'data> {
	inner: Transformer<'alloc, 'data, JsChange<'alloc, 'data>>,
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
		Ok(self.inner.perform(js, &(cfg, flags), true)?)
	}
}

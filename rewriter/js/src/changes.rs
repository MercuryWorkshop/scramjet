use std::cmp::Ordering;

use oxc::{
	allocator::{Allocator, Vec},
	ast::ast::AssignmentOperator,
	span::{Atom, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::{
	cfg::{Config, Flags},
	rewrite::Rewrite,
	RewriterError,
};

// const STRICTCHECKER: &str = "(function(a){arguments[0]=false;return a})(true)";
const STRICTCHECKER: &str = "(function(){return !this;})()";

macro_rules! changes {
	[$($change:expr),+] => {
		smallvec![$(Change::from($change)),+]
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

	/// replace span with `)`
	ReplaceClosingParen,
	/// insert `)`
	ClosingParen { semi: bool },

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

	fn into_inner(self, cfg: &'data Config, flags: &'data Flags, offset: u32) -> Transform<'data> {
		use JsChangeType as Ty;
		match self.ty {
			Ty::WrapFnLeft { wrap } => Transform::insert(if wrap {
				changes!["(", &cfg.wrapfn, "("]
			} else {
				changes![&cfg.wrapfn, "("]
			}),
			Ty::WrapFnRight { wrap } => Transform::insert(if wrap {
				changes![",", STRICTCHECKER, "))"]
			} else {
				changes![",", STRICTCHECKER, ")"]
			}),
			Ty::SetRealmFn => Transform::insert(changes![&cfg.setrealmfn, "({})."]),
			Ty::WrapThisFn => Transform::insert(changes![&cfg.wrapthisfn, "("]),
			Ty::ScramErrFn { ident } => Transform::insert(changes!["$scramerr(", ident, ");"]),
			Ty::ScramitizeFn => Transform::insert(changes![" $scramitize("]),
			Ty::EvalRewriteFn => Transform::replace(changes!["eval(", &cfg.rewritefn, "("]),
			Ty::ShorthandObj { ident } => {
				Transform::insert(changes![":", &cfg.wrapfn, "(", ident, ")"])
			}
			Ty::SourceTag => Transform::insert(changes![
				"/*scramtag ",
				self.span.start + offset,
				" ",
				&flags.sourcetag,
				"*/"
			]),
			Ty::ImportFn => Transform::replace(changes![&cfg.importfn, "(\"", &flags.base, "\","]),
			Ty::MetaFn => Transform::replace(changes![&cfg.metafn, "(\"", &flags.base, "\")"]),
			Ty::AssignmentLeft { name, op } => Transform::replace(changes![
				"((t)=>$scramjet$tryset(",
				name,
				",\"",
				op,
				"\",t)||(",
				name,
				op,
				"t))("
			]),
			Ty::ReplaceClosingParen => Transform::replace(changes![")"]),
			Ty::ClosingParen { semi } => {
				Transform::replace(if semi { changes![");"] } else { changes![")"] })
			}
			Ty::Replace { text } => Transform::replace(changes![text]),
			Ty::Delete => Transform::replace(SmallVec::new()),
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

enum Change<'a> {
	Str(&'a str),
	U32(u32),
}

impl Change<'_> {
	fn eval(&self, itoa: &mut itoa::Buffer, buffer: &mut Vec<'_, u8>) -> usize {
		match self {
			Change::Str(x) => {
				buffer.extend_from_slice(x.as_bytes());
				x.len()
			}
			Change::U32(x) => {
				let x = itoa.format(*x);
				buffer.extend_from_slice(x.as_bytes());
				x.len()
			}
		}
	}
}

impl<'a> From<&'a str> for Change<'a> {
	fn from(value: &'a str) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<&&'a str> for Change<'a> {
	fn from(value: &&'a str) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<&'a String> for Change<'a> {
	fn from(value: &'a String) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<Atom<'a>> for Change<'a> {
	fn from(value: Atom<'a>) -> Self {
		Self::Str(value.as_str())
	}
}

impl From<AssignmentOperator> for Change<'static> {
	fn from(value: AssignmentOperator) -> Self {
		Self::Str(value.as_str())
	}
}

impl From<u32> for Change<'static> {
	fn from(value: u32) -> Self {
		Self::U32(value)
	}
}

type Changes<'a> = SmallVec<[Change<'a>; 8]>;

enum TransformType {
	Insert,
	Replace,
}

struct Transform<'a> {
	pub ty: TransformType,
	pub change: Changes<'a>,
}

impl<'a> Transform<'a> {
	pub fn insert(change: Changes<'a>) -> Self {
		Self {
			ty: TransformType::Insert,
			change,
		}
	}

	pub fn replace(change: Changes<'a>) -> Self {
		Self {
			ty: TransformType::Replace,
			change,
		}
	}

	pub fn apply(&self, itoa: &mut itoa::Buffer, buffer: &mut Vec<'_, u8>) -> u32 {
		let mut len = 0;

		for str in &self.change {
			len += str.eval(itoa, buffer) as u32;
		}

		len
	}
}

pub(crate) struct JsChangeResult<'alloc> {
	pub js: Vec<'alloc, u8>,
	pub sourcemap: Vec<'alloc, u8>,
}

pub(crate) struct JsChanges<'alloc: 'data, 'data> {
	alloc: Option<&'alloc Allocator>,
	inner: std::vec::Vec<JsChange<'alloc, 'data>>,
}

impl<'alloc: 'data, 'data> JsChanges<'alloc, 'data> {
	pub fn new() -> Self {
		Self {
			inner: std::vec::Vec::new(),
			alloc: None,
		}
	}

	pub fn add(&mut self, rewrite: Rewrite<'alloc, 'data>) {
		self.inner.extend(rewrite.into_inner());
	}

	pub fn set_alloc(&mut self, alloc: &'alloc Allocator) -> Result<(), RewriterError> {
		if self.alloc.is_some() {
			Err(RewriterError::AlreadyRewriting)
		} else {
			self.alloc.replace(alloc);
			Ok(())
		}
	}

	pub fn take_alloc(&mut self) -> Result<(), RewriterError> {
		self.alloc
			.take()
			.ok_or(RewriterError::NotRewriting)
			.map(|_| ())
	}

	pub fn get_alloc(&self) -> Result<&'alloc Allocator, RewriterError> {
		self.alloc.ok_or(RewriterError::NotRewriting)
	}

	pub fn empty(&self) -> bool {
		self.inner.is_empty()
	}

	pub fn perform(
		&mut self,
		js: &'data str,
		cfg: &'data Config,
		flags: &'data Flags,
	) -> Result<JsChangeResult<'alloc>, RewriterError> {
		let mut itoa = itoa::Buffer::new();

		let alloc = self.get_alloc()?;

		let mut cursor = 0;
		let mut offset = 0i32;
		let mut buffer = Vec::with_capacity_in(js.len() * 2, alloc);

		macro_rules! tryget {
			($start:ident..$end:ident) => {
				js.get($start as usize..$end as usize)
					.ok_or_else(|| RewriterError::Oob($start, $end))?
			};
		}

		// insert has a 9 byte size, replace has a 13 byte minimum and usually it's like 5 bytes
		// for the old str added on so use 16 as a really rough estimate
		let mut map = Vec::with_capacity_in((self.inner.len() * 16) + 4, alloc);
		map.extend_from_slice(&(self.inner.len() as u32).to_le_bytes());

		self.inner.sort();

		for change in self.inner.drain(..) {
			let Span { start, end, .. } = change.span;

			buffer.extend_from_slice(tryget!(cursor..start).as_bytes());

			let transform = change.into_inner(cfg, flags, cursor);
			let len = transform.apply(&mut itoa, &mut buffer);
			// pos
			map.extend_from_slice(&start.wrapping_add_signed(offset).to_le_bytes());
			// size
			map.extend_from_slice(&len.to_le_bytes());

			match transform.ty {
				TransformType::Insert => {
					buffer.extend_from_slice(tryget!(start..end).as_bytes());

					// INSERT op
					map.push(0);

					offset = offset.wrapping_add_unsigned(len);
				}
				TransformType::Replace => {
					// REPLACE op
					map.push(1);
					// len
					map.extend_from_slice(&(end - start).to_le_bytes());
					// oldstr
					map.extend_from_slice(tryget!(start..end).as_bytes());

					let len = i32::try_from(len).map_err(|_| RewriterError::AddedTooLarge)?;
					let diff = len.wrapping_sub_unsigned(end - start);
					offset = offset.wrapping_add(diff);
				}
			}

			cursor = end;
		}

		let js_len = js.len() as u32;
		buffer.extend_from_slice(tryget!(cursor..js_len).as_bytes());

		Ok(JsChangeResult {
			js: buffer,
			sourcemap: map,
		})
	}
}

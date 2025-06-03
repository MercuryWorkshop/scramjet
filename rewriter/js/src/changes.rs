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
pub enum JsChange<'alloc: 'data, 'data> {
	/// insert `${cfg.wrapfn}(`
	WrapFnLeft { span: Span, extra: bool },
	/// insert `,strictchecker)`
	WrapFnRight { span: Span, extra: bool },
	/// insert `${cfg.setrealmfn}({}).`
	SetRealmFn { span: Span },
	/// insert `${cfg.wrapthis}(`
	WrapThisFn { span: Span },
	/// insert `$scramerr(ident);`
	ScramErrFn { span: Span, ident: Atom<'data> },
	/// insert `$scramitize(`
	ScramitizeFn { span: Span },
	/// insert `eval(${cfg.rewritefn}(`
	EvalRewriteFn { span: Span },
	/// insert `: ${cfg.wrapfn}(ident)`
	ShorthandObj { span: Span, ident: Atom<'data> },
	/// insert scramtag
	SourceTag { span: Span },

	/// replace span with `${cfg.importfn}`
	ImportFn { span: Span },
	/// replace span with `${cfg.metafn}("${cfg.base}")`
	MetaFn { span: Span },
	/// replace span with `((t)=>$scramjet$tryset(${name},"${op}",t)||(${name}${op}t))(`
	AssignmentLeft {
		span: Span,
		name: Atom<'data>,
		op: AssignmentOperator,
	},

	/// replace span with `)`
	ReplaceClosingParen { span: Span },
	/// insert `)`
	ClosingParen { span: Span, semi: bool },

	/// replace span with text
	Replace { span: Span, text: &'alloc str },
	/// replace span with ""
	Delete { span: Span },
}

impl<'alloc: 'data, 'data> JsChange<'alloc, 'data> {
	fn get_span(&self) -> &Span {
		match self {
			Self::WrapFnLeft { span, .. }
			| Self::WrapFnRight { span, .. }
			| Self::SetRealmFn { span }
			| Self::WrapThisFn { span }
			| Self::ScramErrFn { span, .. }
			| Self::ScramitizeFn { span }
			| Self::EvalRewriteFn { span }
			| Self::ShorthandObj { span, .. }
			| Self::SourceTag { span, .. }
			| Self::ImportFn { span }
			| Self::MetaFn { span }
			| Self::AssignmentLeft { span, .. }
			| Self::ReplaceClosingParen { span }
			| Self::ClosingParen { span, .. }
			| Self::Replace { span, .. }
			| Self::Delete { span } => span,
		}
	}

	fn into_inner(
		self,
		cfg: &'data Config,
		flags: &'data Flags,
		offset: u32,
	) -> Transform<'data> {
		match self {
			Self::WrapFnLeft { span, extra } => {
				if extra {
					Transform::Insert {
						loc: span.start,
						str: changes!["(", &cfg.wrapfn, "("],
					}
				} else {
					Transform::Insert {
						loc: span.start,
						str: changes![&cfg.wrapfn, "("],
					}
				}
			}
			Self::WrapFnRight { span, extra } => {
				if extra {
					Transform::Insert {
						loc: span.start,
						str: changes![",", STRICTCHECKER, "))"],
					}
				} else {
					Transform::Insert {
						loc: span.start,
						str: changes![",", STRICTCHECKER, ")"],
					}
				}
			}
			Self::SetRealmFn { span } => Transform::Insert {
				loc: span.start,
				str: changes![&cfg.setrealmfn, "({})."],
			},
			Self::WrapThisFn { span } => Transform::Insert {
				loc: span.start,
				str: changes![&cfg.wrapthisfn, "("],
			},
			Self::ScramErrFn { span, ident } => Transform::Insert {
				loc: span.start,
				str: changes!["$scramerr(", ident, ");"],
			},
			Self::ScramitizeFn { span } => Transform::Insert {
				loc: span.start,
				str: changes![" $scramitize("],
			},
			Self::EvalRewriteFn { .. } => Transform::Replace {
				str: changes!["eval(", &cfg.rewritefn, "("],
			},
			Self::ShorthandObj { span, ident } => Transform::Insert {
				loc: span.start,
				str: changes![":", &cfg.wrapfn, "(", ident, ")"],
			},
			Self::SourceTag { span } => Transform::Insert {
				loc: span.start,
				str: changes![
					"/*scramtag ",
					span.start + offset,
					" ",
					&flags.sourcetag,
					"*/"
				],
			},
			Self::ImportFn { .. } => Transform::Replace {
				str: changes![&cfg.importfn, "(\"", &flags.base, "\","],
			},
			Self::MetaFn { .. } => Transform::Replace {
				str: changes![&cfg.metafn, "(\"", &flags.base, "\")"],
			},
			Self::AssignmentLeft { name, op, .. } => Transform::Replace {
				str: changes![
					"((t)=>$scramjet$tryset(",
					name,
					",\"",
					op,
					"\",t)||(",
					name,
					op,
					"t))("
				],
			},
			Self::ReplaceClosingParen { .. } => Transform::Replace { str: changes![")"] },
			Self::ClosingParen { span, semi } => Transform::Insert {
				loc: span.start,
				str: if semi { changes![");"] } else { changes![")"] },
			},
			Self::Replace { text, .. } => Transform::Replace {
				str: changes![text],
			},
			Self::Delete { .. } => Transform::Replace { str: changes![""] },
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
		match self.get_span().start.cmp(&other.get_span().start) {
			Ordering::Equal => match (self, other) {
				(Self::ScramErrFn { .. }, _) => Ordering::Less,
				(_, Self::ScramErrFn { .. }) => Ordering::Greater,
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

enum Transform<'a> {
	Insert { loc: u32, str: Changes<'a> },
	Replace { str: Changes<'a> },
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
		macro_rules! eval {
			($change:expr) => {
				match $change {
					Change::Str(x) => {
						buffer.extend_from_slice(x.as_bytes());
						x.len()
					}
					Change::U32(x) => {
						let x = itoa.format(x);
						buffer.extend_from_slice(x.as_bytes());
						x.len()
					}
				}
			};
		}

		// insert has a 9 byte size, replace has a 13 byte minimum and usually it's like 5 bytes
		// for the old str added on so use 16 as a really rough estimate
		let mut map = Vec::with_capacity_in(self.inner.len() * 16, alloc);
		map.extend_from_slice(&(self.inner.len() as u32).to_le_bytes());

		self.inner.sort();

		for change in self.inner.drain(..) {
			let Span { start, end, .. } = *change.get_span();

			buffer.extend_from_slice(tryget!(cursor..start).as_bytes());

			match change.into_inner(cfg, flags, cursor) {
				Transform::Insert { loc, str } => {
					let mut len = 0u32;
					buffer.extend_from_slice(tryget!(start..loc).as_bytes());
					for str in str {
						len += eval!(str) as u32;
					}
					buffer.extend_from_slice(tryget!(loc..end).as_bytes());

					// INSERT op
					map.push(0);
					// pos
					map.extend_from_slice(&loc.wrapping_add_signed(offset).to_le_bytes());
					// size
					map.extend_from_slice(&len.to_le_bytes());

					offset = offset.wrapping_add_unsigned(len);
				}
				Transform::Replace { str } => {
					let mut len = 0u32;
					for str in str {
						len += eval!(str) as u32;
					}

					// REPLACE op
					map.push(1);
					// len
					map.extend_from_slice(&(end - start).to_le_bytes());
					// start
					map.extend_from_slice(&(start.wrapping_add_signed(offset)).to_le_bytes());
					// end
					map.extend_from_slice(
						&((start + len).wrapping_add_signed(offset)).to_le_bytes(),
					);
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

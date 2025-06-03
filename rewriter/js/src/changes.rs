use std::cmp::Ordering;

use oxc::{
	allocator::{Allocator, Vec},
	ast::ast::AssignmentOperator,
	span::{format_compact_str, Atom, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::{
	cfg::{Config, Flags},
	RewriterError,
};

// const STRICTCHECKER: &str = "(function(a){arguments[0]=false;return a})(true)";
const STRICTCHECKER: &str = "(function(){return !this;})()";

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
	fn into_inner(self) -> SmallVec<[JsChange<'alloc, 'data>; 4]> {
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

macro_rules! changes {
	[$($change:expr),+] => {
		smallvec![$(Change::from($change)),+]
    };
}

#[derive(Debug, PartialEq, Eq)]
enum JsChange<'alloc: 'data, 'data> {
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
	) -> JsChangeInner<'data> {
		match self {
			Self::WrapFnLeft { span, extra } => {
				if extra {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes!["(", &cfg.wrapfn, "("],
					}
				} else {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes![&cfg.wrapfn, "("],
					}
				}
			}
			Self::WrapFnRight { span, extra } => {
				if extra {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes![",", STRICTCHECKER, "))"],
					}
				} else {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes![",", STRICTCHECKER, ")"],
					}
				}
			}
			Self::SetRealmFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![&cfg.setrealmfn, "({})."],
			},
			Self::WrapThisFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![&cfg.wrapthisfn, "("],
			},
			Self::ScramErrFn { span, ident } => JsChangeInner::Insert {
				loc: span.start,
				str: changes!["$scramerr(", ident, ");"],
			},
			Self::ScramitizeFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![" $scramitize("],
			},
			Self::EvalRewriteFn { .. } => JsChangeInner::Replace {
				str: changes!["eval(", &cfg.rewritefn, "("],
			},
			Self::ShorthandObj { span, ident } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![":", &cfg.wrapfn, "(", ident, ")"],
			},
			Self::SourceTag { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![
					"/*scramtag ",
					span.start + offset,
					" ",
					&flags.sourcetag,
					"*/"
				],
			},
			Self::ImportFn { .. } => JsChangeInner::Replace {
				str: changes![&cfg.importfn, "(\"", &flags.base, "\","],
			},
			Self::MetaFn { .. } => JsChangeInner::Replace {
				str: changes![&cfg.metafn, "(\"", &flags.base, "\")"],
			},
			Self::AssignmentLeft { name, op, .. } => JsChangeInner::Replace {
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
			Self::ReplaceClosingParen { .. } => JsChangeInner::Replace { str: changes![")"] },
			Self::ClosingParen { span, semi } => JsChangeInner::Insert {
				loc: span.start,
				str: if semi { changes![");"] } else { changes![")"] },
			},
			Self::Replace { text, .. } => JsChangeInner::Replace {
				str: changes![text],
			},
			Self::Delete { .. } => JsChangeInner::Replace { str: changes![""] },
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

enum JsChangeInner<'a> {
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
		for change in rewrite.into_inner() {
			self.inner.push(change);
		}
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
						let x = format_compact_str!("{}", x);
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
				JsChangeInner::Insert { loc, str } => {
					let mut len = 0u32;
					buffer.extend_from_slice(tryget!(start..loc).as_bytes());
					for str in &str {
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
				JsChangeInner::Replace { str } => {
					let mut len = 0u32;
					for str in &str {
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

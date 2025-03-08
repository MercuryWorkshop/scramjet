use std::cmp::Ordering;

use oxc::{
	allocator::{Allocator, String, Vec},
	ast::ast::AssignmentOperator,
	span::{format_compact_str, Atom, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::{cfg::Config, RewriterError};

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Rewrite<'data> {
	/// `(cfg.wrapfn(ident))` | `cfg.wrapfn(ident)`
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
		text: String<'data>,
	},
	Delete {
		span: Span,
	},
}

impl<'data> Rewrite<'data> {
	fn into_inner(self) -> SmallVec<[JsChange<'data>; 4]> {
		match self {
			Self::WrapFn { wrapped, span } => {
				let start = Span::new(span.start, span.start);
				let end = Span::new(span.end, span.end);
				if wrapped {
					smallvec![
						JsChange::WrapFn {
							span: start,
							extra: true
						},
						JsChange::DoubleClosingParen { span: end }
					]
				} else {
					smallvec![
						JsChange::WrapFn {
							span: start,
							extra: false
						},
						JsChange::ClosingParen {
							span: end,
							semi: false,
						}
					]
				}
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

enum Change<'a> {
	Str(&'a str),
	Number(usize),
}

impl<'a> From<&'a str> for Change<'a> {
	fn from(value: &'a str) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<&'a String<'_>> for Change<'a> {
	fn from(value: &'a String<'_>) -> Self {
		Self::Str(value.as_str())
	}
}

impl<'a> From<&'a Atom<'_>> for Change<'a> {
	fn from(value: &'a Atom<'_>) -> Self {
		Self::Str(value.as_str())
	}
}

impl<'a> From<&'a AssignmentOperator> for Change<'a> {
	fn from(value: &'a AssignmentOperator) -> Self {
		Self::Str(value.as_str())
	}
}

impl From<usize> for Change<'static> {
	fn from(value: usize) -> Self {
		Self::Number(value)
	}
}

macro_rules! changes {
	[$($change:expr),+] => {
		smallvec![$(Change::from($change)),+]
    };
}

type Changes<'a> = SmallVec<[Change<'a>; 8]>;

enum JsChangeInner<'a> {
	Insert { loc: u32, str: Changes<'a> },
	Replace { str: Changes<'a> },
}

#[derive(Debug, PartialEq, Eq)]
enum JsChange<'data> {
	/// insert `${cfg.wrapfn}(`
	WrapFn { span: Span, extra: bool },
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
	/// insert `))`
	DoubleClosingParen { span: Span },

	/// replace span with text
	Replace { span: Span, text: String<'data> },
	/// replace span with ""
	Delete { span: Span },
}

impl JsChange<'_> {
	fn get_span(&self) -> &Span {
		match self {
			Self::WrapFn { span, .. }
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
			| Self::DoubleClosingParen { span }
			| Self::Replace { span, .. }
			| Self::Delete { span } => span,
		}
	}

	fn to_inner<'alloc, 'change, E>(
		&'change self,
		cfg: &'change Config<'alloc, E>,
		offset: usize,
	) -> JsChangeInner<'change>
	where
		E: Fn(&str, &'alloc Allocator) -> String<'alloc>,
	{
		match self {
			Self::WrapFn { span, extra } => {
				if *extra {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes!["(", cfg.wrapfn, "("],
					}
				} else {
					JsChangeInner::Insert {
						loc: span.start,
						str: changes![cfg.wrapfn, "("],
					}
				}
			}
			Self::SetRealmFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![cfg.setrealmfn, "({})."],
			},
			Self::WrapThisFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![cfg.wrapthisfn, "("],
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
				str: changes!["eval(", cfg.rewritefn, "("],
			},
			Self::ShorthandObj { span, ident } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![":", cfg.wrapfn, "(", ident, ")"],
			},
			Self::SourceTag { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes![
					"/*scramtag ",
					span.start as usize + offset,
					" ",
					cfg.sourcetag,
					"*/"
				],
			},
			Self::ImportFn { .. } => JsChangeInner::Replace {
				str: changes![cfg.importfn, "(\"", cfg.base, "\","],
			},
			Self::MetaFn { .. } => JsChangeInner::Replace {
				str: changes![cfg.metafn, "(\"", cfg.base, "\")"],
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
				str: if *semi { changes![");"] } else { changes![")"] },
			},
			Self::DoubleClosingParen { span } => JsChangeInner::Insert {
				loc: span.start,
				str: changes!["))"],
			},
			Self::Replace { text, .. } => JsChangeInner::Replace {
				str: changes![text],
			},
			Self::Delete { .. } => JsChangeInner::Replace { str: changes![""] },
		}
	}
}

impl PartialOrd for JsChange<'_> {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for JsChange<'_> {
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

pub(crate) struct JsChangeResult<'alloc> {
	pub js: Vec<'alloc, u8>,
	pub sourcemap: Vec<'alloc, u8>,
}

pub(crate) struct JsChanges<'alloc: 'data, 'data> {
	alloc: &'alloc Allocator,
	inner: Vec<'alloc, JsChange<'data>>,
}

impl<'alloc: 'data, 'data> JsChanges<'alloc, 'data> {
	pub fn new(alloc: &'alloc Allocator, capacity: usize) -> Self {
		Self {
			inner: Vec::with_capacity_in(capacity, alloc),
			alloc,
		}
	}

	pub fn add(&mut self, rewrite: Rewrite<'data>) {
		for change in rewrite.into_inner() {
			self.inner.push(change);
		}
	}

	pub fn perform<E>(
		&mut self,
		js: &str,
		cfg: &Config<'alloc, E>,
	) -> Result<JsChangeResult<'alloc>, RewriterError>
	where
		E: Fn(&str, &'alloc Allocator) -> String<'alloc>,
	{
		let mut offset = 0;
		let mut added = 0i64;
		let mut buffer = Vec::with_capacity_in(js.len() * 2, self.alloc);

		macro_rules! tryget {
			($range:expr) => {
				js.get($range)
					.ok_or_else(|| RewriterError::Oob(($range).start, ($range).end))?
			};
		}
		macro_rules! eval {
			($change:expr) => {
				match $change {
					Change::Str(x) => {
						buffer.extend_from_slice(x.as_bytes());
						x.len()
					}
					Change::Number(x) => {
						let x = format_compact_str!("{}", x);
						buffer.extend_from_slice(x.as_bytes());
						x.len()
					}
				}
			};
		}

		let mut map = Vec::with_capacity_in(js.len() * 2, self.alloc);
		map.extend_from_slice(&(self.inner.len() as u32).to_le_bytes());

		self.inner.sort();

		for change in &self.inner {
			let span = change.get_span();
			let start = span.start as usize;
			let end = span.end as usize;

			buffer.extend_from_slice(tryget!(offset..start).as_bytes());

			match change.to_inner(cfg, offset) {
				JsChangeInner::Insert { loc, str } => {
					let mut len = 0u32;
					let loc = loc as usize;
					buffer.extend_from_slice(tryget!(start..loc).as_bytes());
					for str in &str {
						len += eval!(str) as u32;
					}
					buffer.extend_from_slice(tryget!(loc..end).as_bytes());

					// INSERT op
					map.push(0);
					// pos
					map.extend_from_slice(
						&((loc as u32).wrapping_add_signed(added as i32)).to_le_bytes(),
					);
					// size
					map.extend_from_slice(&len.to_le_bytes());

					added += len as i64;
				}
				JsChangeInner::Replace { str } => {
					let mut len = 0u32;
					for str in &str {
						len += eval!(str) as u32;
					}

					// REPLACE op
					map.push(1);
					// len
					map.extend_from_slice(&(span.end - span.start).to_le_bytes());
					// start
					map.extend_from_slice(
						&(span.start.wrapping_add_signed(added as i32)).to_le_bytes(),
					);
					// end
					map.extend_from_slice(
						&((span.start + len).wrapping_add_signed(added as i32)).to_le_bytes(),
					);
					// oldstr
					map.extend_from_slice(tryget!(start..end).as_bytes());

					added += len as i64 - (span.end - span.start) as i64;
				}
			}

			offset = end;
		}

		let js_len = js.len();
		buffer.extend_from_slice(tryget!(offset..js_len).as_bytes());

		Ok(JsChangeResult {
			js: buffer,
			sourcemap: map,
		})
	}
}

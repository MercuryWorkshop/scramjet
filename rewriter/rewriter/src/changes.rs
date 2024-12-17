use std::cmp::Ordering;

use oxc::{
	ast::ast::AssignmentOperator,
	span::{CompactStr, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::{cfg::Config, RewriterError};

#[derive(Debug, PartialEq, Eq, Clone)]
pub(crate) enum Rewrite {
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
		ident: CompactStr,
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
		name: CompactStr,
		entirespan: Span,
		rhsspan: Span,
		op: AssignmentOperator,
	},
	/// `ident,` -> `ident: cfg.wrapfn(ident),`
	ShorthandObj {
		span: Span,
		name: CompactStr,
	},
	SourceTag {
		span: Span,
		tagname: String,
	},

	// don't use for anything static, only use for stuff like rewriteurl
	Replace {
		span: Span,
		text: String,
	},
	Delete {
		span: Span,
	},
}

impl Rewrite {
	fn into_inner(self) -> SmallVec<[JsChange; 4]> {
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
			Self::SourceTag { tagname, span } => smallvec![JsChange::SourceTag { span, tagname }],
			Self::Replace { text, span } => smallvec![JsChange::Replace { span, text }],
			Self::Delete { span } => smallvec![JsChange::Delete { span }],
		}
	}
}

#[derive(Debug, PartialEq, Eq, Clone)]
enum JsChange {
	/// insert `${cfg.wrapfn}(`
	WrapFn { span: Span, extra: bool },
	/// insert `${cfg.setrealmfn}({}).`
	SetRealmFn { span: Span },
	/// insert `${cfg.wrapthis}(`
	WrapThisFn { span: Span },
	/// insert `$scramerr(ident);`
	ScramErrFn { span: Span, ident: CompactStr },
	/// insert `$scramitize(`
	ScramitizeFn { span: Span },
	/// insert `eval(${cfg.rewritefn}(`
	EvalRewriteFn { span: Span },
	/// insert `: ${cfg.wrapfn}(ident)`
	ShorthandObj { span: Span, ident: CompactStr },
	/// insert scramtag
	SourceTag { span: Span, tagname: String },

	/// replace span with `(${cfg.importfn}("${cfg.base}"))`
	ImportFn { span: Span },
	/// replace span with `${cfg.metafn}("${cfg.base}")`
	MetaFn { span: Span },
	/// replace span with `((t)=>$scramjet$tryset(${name},"${op}",t)||(${name}${op}t))(`
	AssignmentLeft {
		span: Span,
		name: CompactStr,
		op: AssignmentOperator,
	},

	/// replace span with `)`
	ReplaceClosingParen { span: Span },
	/// insert `)`
	ClosingParen { span: Span, semi: bool },
	/// insert `))`
	DoubleClosingParen { span: Span },

	/// replace span with text
	Replace { span: Span, text: String },
	/// replace span with ""
	Delete { span: Span },
}

impl JsChange {
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

	fn to_inner<'a, E>(&'a self, cfg: &'a Config<E>) -> JsChangeInner<'a>
	where
		E: Fn(String) -> String,
		E: Clone,
	{
		match self {
			Self::WrapFn { span, extra } => {
				if *extra {
					JsChangeInner::Insert {
						loc: span.start,
						str: smallvec!["(", cfg.wrapfn.as_str(), "("],
					}
				} else {
					JsChangeInner::Insert {
						loc: span.start,
						str: smallvec![cfg.wrapfn.as_str(), "("],
					}
				}
			}
			Self::SetRealmFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec![cfg.setrealmfn.as_str(), "({})."],
			},
			Self::WrapThisFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec![cfg.wrapthisfn.as_str(), "("],
			},
			Self::ScramErrFn { span, ident } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec!["$scramerr(", ident.as_str(), ");"],
			},
			Self::ScramitizeFn { span } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec![" $scramitize("],
			},
			Self::EvalRewriteFn { .. } => JsChangeInner::Replace {
				str: smallvec!["eval(", cfg.rewritefn.as_str(), "("],
			},
			Self::ShorthandObj { span, ident } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec![":", cfg.wrapfn.as_str(), "(", ident.as_str(), ")"],
			},
			Self::SourceTag { span, tagname } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec![
					"/*scramtag ",
					tagname.as_str(),
					" ",
					cfg.sourcetag.as_str(),
					"*/"
				],
			},
			Self::ImportFn { .. } => JsChangeInner::Replace {
				str: smallvec!["(", cfg.importfn.as_str(), "(\"", cfg.base.as_str(), "\"))"],
			},
			Self::MetaFn { .. } => JsChangeInner::Replace {
				str: smallvec![cfg.metafn.as_str(), "(\"", cfg.base.as_str()],
			},
			Self::AssignmentLeft { name, op, .. } => JsChangeInner::Replace {
				str: smallvec![
					"((t)=>$scramjet$tryset(",
					name.as_str(),
					",\"",
					op.as_str(),
					"\",t)||(",
					name.as_str(),
					op.as_str(),
					"t))("
				],
			},
			Self::ReplaceClosingParen { .. } => JsChangeInner::Replace {
				str: smallvec![")"],
			},
			Self::ClosingParen { span, semi } => JsChangeInner::Insert {
				loc: span.start,
				str: if *semi {
					smallvec![");"]
				} else {
					smallvec![")"]
				},
			},
			Self::DoubleClosingParen { span } => JsChangeInner::Insert {
				loc: span.start,
				str: smallvec!["))"],
			},
			Self::Replace { text, .. } => JsChangeInner::Replace {
				str: smallvec![text.as_str()],
			},
			Self::Delete { .. } => JsChangeInner::Replace { str: smallvec![""] },
		}
	}
}

impl PartialOrd for JsChange {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for JsChange {
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

type Changes<'a> = SmallVec<[&'a str; 8]>;

enum JsChangeInner<'a> {
	Insert { loc: u32, str: Changes<'a> },
	Replace { str: Changes<'a> },
}

pub(crate) struct JsChangeResult {
	pub js: Vec<u8>,
	pub sourcemap: Vec<u8>,
}

pub(crate) struct JsChanges {
	inner: Vec<JsChange>,
}

impl JsChanges {
	pub fn new() -> Self {
		Self {
			inner: Default::default(),
		}
	}

	pub fn add(&mut self, rewrite: Rewrite) {
		for change in rewrite.into_inner() {
			self.inner.push(change);
		}
	}

	pub fn perform<E>(&mut self, js: &str, cfg: &Config<E>) -> Result<JsChangeResult, RewriterError>
	where
		E: Fn(String) -> String,
		E: Clone,
	{
		let mut offset = 0;
		let mut buffer = Vec::with_capacity(js.len() * 2);

		macro_rules! tryget {
			($range:expr) => {
				js.get($range)
					.ok_or_else(|| RewriterError::Oob(($range).start, ($range).end))?
			};
		}

		// TODO: add sourcemaps
		let map = Vec::with_capacity(js.len() * 2);

		self.inner.sort_unstable();

		for change in &self.inner {
			let span = change.get_span();
			let start = span.start as usize;
			let end = span.end as usize;

			buffer.extend_from_slice(tryget!(offset..start).as_bytes());

			let inner = change.to_inner(cfg);
			match inner {
				JsChangeInner::Insert { loc, str } => {
					let loc = loc as usize;
					buffer.extend_from_slice(tryget!(start..loc).as_bytes());
					for str in str {
						buffer.extend_from_slice(str.as_bytes());
					}
					buffer.extend_from_slice(tryget!(loc..end).as_bytes());
				}
				JsChangeInner::Replace { str } => {
					for str in str {
						buffer.extend_from_slice(str.as_bytes());
					}
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

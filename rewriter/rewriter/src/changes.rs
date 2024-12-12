use oxc::{
	ast::ast::AssignmentOperator,
	span::{CompactStr, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::{cfg::Config, RewriterError};

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum Rewrite {
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

	/// `$scramerr(name)`
	ScramErr {
		span: Span,
		name: CompactStr,
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
	/// `ident,` -> `ident: cfg.wrapfn(ident)`
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
	pub fn get_span(&self) -> &Span {
		match self {
			Self::WrapFn { span, .. } => span,
			Self::SetRealmFn { span, .. } => span,
			Self::WrapThisFn { span } => span,
			Self::ImportFn { span } => span,
			Self::MetaFn { span } => span,

			Self::ScramErr { span, .. } => span,
			Self::Scramitize { span } => span,

			Self::Eval { span, .. } => span,
			Self::Assignment { entirespan, .. } => entirespan,
			Self::ShorthandObj { span, .. } => span,
			Self::SourceTag { span, .. } => span,

			Self::Replace { span, .. } => span,
			Self::Delete { span } => span,
		}
	}

	// returns (bunch of stuff to add before, option<bunch of stuff to add after>)
	// bunch of stuff to add after should only be some if it's not a replace op
	fn to_inner<'a, E>(&'a self, cfg: &'a Config<E>) -> JsChangeInner<'a>
	where
		E: Fn(String) -> String,
		E: Clone,
	{
		match self {
			Self::WrapFn { wrapped, span } => {
				if *wrapped {
					JsChangeInner::Wrap {
						before: smallvec!["(", cfg.wrapfn.as_str(), "("],
						inner: span,
						after: smallvec!["))"],
					}
				} else {
					JsChangeInner::Wrap {
						before: smallvec![cfg.wrapfn.as_str(), "("],
						inner: span,
						after: smallvec![")"],
					}
				}
			}
			Self::SetRealmFn { span } => JsChangeInner::Wrap {
				before: smallvec![cfg.setrealmfn.as_str(), "({})."],
				inner: span,
				after: smallvec![],
			},
			Self::WrapThisFn { span } => JsChangeInner::Wrap {
				before: smallvec![cfg.wrapthisfn.as_str(), "("],
				inner: span,
				after: smallvec![")"],
			},
			Self::ImportFn { .. } => JsChangeInner::Replace(smallvec![
				"(",
				cfg.importfn.as_str(),
				"(\"",
				cfg.base.as_str(),
				"\"))"
			]),
			Self::MetaFn { .. } => JsChangeInner::Replace(smallvec![
				cfg.metafn.as_str(),
				"(\"",
				cfg.base.as_str(),
				"\")"
			]),

			// maps to insert
			Self::ScramErr { name, .. } => {
				JsChangeInner::Replace(smallvec!["$scramerr(", name.as_str(), ");"])
			}
			Self::Scramitize { span } => JsChangeInner::Wrap {
				before: smallvec!["$scramitize("],
				inner: span,
				after: smallvec![")"],
			},

			Self::Eval { inner, .. } => JsChangeInner::Wrap {
				before: smallvec!["eval(", cfg.rewritefn.as_str(), "("],
				inner,
				after: smallvec![")"],
			},
			Self::Assignment {
				name, rhsspan, op, ..
			} => JsChangeInner::Wrap {
				before: smallvec![
					"((t)=>$scramjet$tryset(",
					name.as_str(),
					",\"",
					op.as_str(),
					"\",t)||(",
					name.as_str(),
					op.as_str(),
					"t))("
				],
				inner: rhsspan,
				after: smallvec![")"],
			},
			// maps to insert
			Self::ShorthandObj { name, .. } => JsChangeInner::Replace(smallvec![
				name.as_str(),
				":",
				cfg.wrapfn.as_str(),
				"(",
				name.as_str(),
				")"
			]),
			// maps to insert
			Self::SourceTag { tagname, .. } => JsChangeInner::Replace(smallvec![
				"/*scramtag ",
				tagname.as_str(),
				" ",
				cfg.sourcetag.as_str(),
				"*/"
			]),
			Self::Replace { text, .. } => JsChangeInner::Replace(smallvec![text.as_str()]),
			Self::Delete { .. } => JsChangeInner::Replace(smallvec![]),
		}
	}
}

impl PartialOrd for Rewrite {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for Rewrite {
	fn cmp(&self, other: &Self) -> std::cmp::Ordering {
		self.get_span().start.cmp(&other.get_span().start)
	}
}

type Changes<'a> = SmallVec<[&'a str; 8]>;

enum JsChangeInner<'a> {
	Wrap {
		/// Changes to add before span
		before: Changes<'a>,
		/// Span to add in between
		inner: &'a Span,
		/// Changes to add after span
		after: Changes<'a>,
	},
	Replace {
		str: Changes<'a>,
	},
}

pub(crate) struct JsChangeResult {
	pub js: Vec<u8>,
	pub sourcemap: Vec<u8>,
}

pub(crate) struct JsChanges {
	pub inner: Vec<Rewrite>,
}

impl JsChanges {
	pub fn new() -> Self {
		Self { inner: Vec::new() }
	}

	pub fn add(&mut self, change: Rewrite) {
		self.inner.push(change);
	}

	pub fn perform<E>(&mut self, js: &str, cfg: &Config<E>) -> Result<JsChangeResult, RewriterError>
	where
		E: Fn(String) -> String,
		E: Clone,
	{
		let mut offset = 0;
		let mut buffer = Vec::with_capacity(((js.len() as u64 * 120) / 100) as usize);

		// TODO: add sourcemaps
		let map = Vec::with_capacity(js.len() * 2);

		self.inner.sort();

		for change in &self.inner {
			let span = change.get_span();
			let start = span.start as usize;
			let end = span.end as usize;

			buffer.extend_from_slice(
				js.get(offset..start)
					.ok_or_else(|| RewriterError::Oob(offset..start))?
					.as_bytes(),
			);

			let inner = change.to_inner(cfg);
			match inner {
				JsChangeInner::Wrap {
					before,
					inner: wrapspan,
					after,
				} => {
					// wrap op
					for str in before {
						buffer.extend_from_slice(str.as_bytes());
					}

					let wrapstart = wrapspan.start as usize;
					let wrapend = wrapspan.end as usize;
					buffer.extend_from_slice(
						js.get(wrapstart..wrapend)
							.ok_or_else(|| RewriterError::Oob(wrapstart..wrapend))?
							.as_bytes(),
					);

					for str in after {
						buffer.extend_from_slice(str.as_bytes());
					}
				}
				JsChangeInner::Replace(list) => {
					for str in list {
						buffer.extend_from_slice(str.as_bytes());
					}
				}
			}

			offset = end;
		}

		let js_len = js.len();
		buffer.extend_from_slice(
			js.get(offset..js_len)
				.ok_or_else(|| RewriterError::Oob(offset..js_len))?
				.as_bytes(),
		);

		Ok(JsChangeResult {
			js: buffer,
			sourcemap: map,
		})
	}
}

use oxc::{
	ast::ast::AssignmentOperator,
	span::{CompactStr, Span},
};
use smallvec::{smallvec, SmallVec};

use crate::cfg::Config;

#[derive(Debug, PartialEq, Eq)]
pub enum JsChange {
	/// `(cfg.wrapfn(ident))` | `cfg.wrapfn(ident)`
	WrapFn {
		span: Span,
		ident: CompactStr,
		wrapped: bool,
	},
	/// `cfg.setrealmfn({}).ident`
	SetRealmFn {
		span: Span,
		ident: CompactStr,
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

type Changes<'a> = SmallVec<[&'a str; 8]>;

enum JsChangeInner<'a> {
	Wrap {
		/// Changes to add before span
		before: Changes<'a>,
		/// Span to add in between
		span: &'a Span,
		/// Changes to add after span
		after: Changes<'a>,
	},
	Replace(Changes<'a>),
}

impl JsChange {
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
			Self::WrapFn { ident, wrapped, .. } => JsChangeInner::Replace(if *wrapped {
				smallvec!["(", cfg.wrapfn.as_str(), "(", ident.as_str(), ")", ")"]
			} else {
				smallvec![cfg.wrapfn.as_str(), "(", ident.as_str(), ")"]
			}),
			Self::SetRealmFn { ident, .. } => {
				JsChangeInner::Replace(smallvec![cfg.setrealmfn.as_str(), "({}).", ident.as_str()])
			}
			Self::WrapThisFn { .. } => {
				JsChangeInner::Replace(smallvec![cfg.wrapthisfn.as_str(), "(this)"])
			}
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

			Self::ScramErr { name, .. } => {
				JsChangeInner::Replace(smallvec!["$scramerr(", name.as_str(), ");"])
			}
			Self::Scramitize { span } => JsChangeInner::Wrap {
				before: smallvec!["$scramitize("],
				span,
				after: smallvec![")"],
			},

			Self::Eval { inner, .. } => JsChangeInner::Wrap {
				before: smallvec!["eval(", cfg.rewritefn.as_str(), "("],
				span: inner,
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
				span: rhsspan,
				after: smallvec![")"],
			},
			Self::ShorthandObj { name, .. } => JsChangeInner::Replace(smallvec![
				name.as_str(),
				":",
				cfg.wrapfn.as_str(),
				"(",
				name.as_str(),
				")"
			]),
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

impl PartialOrd for JsChange {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for JsChange {
	fn cmp(&self, other: &Self) -> std::cmp::Ordering {
		self.get_span().start.cmp(&other.get_span().start)
	}
}

pub(crate) struct JsChangeResult {
	pub js: Vec<u8>,
	pub sourcemap: Vec<u8>,
}

pub(crate) struct JsChanges {
	pub inner: Vec<JsChange>,
}

impl JsChanges {
	pub fn new() -> Self {
		Self { inner: Vec::new() }
	}

	pub fn add(&mut self, change: JsChange) {
		self.inner.push(change);
	}

	pub fn perform<E>(&mut self, js: &str, cfg: &Config<E>) -> JsChangeResult
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

			buffer.extend_from_slice(js[offset..start].as_bytes());

			let change = change.to_inner(cfg);
			match change {
				JsChangeInner::Wrap {
					before,
					span: wrapspan,
					after,
				} => {
					// wrap op
					for str in before {
						buffer.extend_from_slice(str.as_bytes());
					}

					let wrapstart = wrapspan.start as usize;
					let wrapend = wrapspan.end as usize;
					buffer.extend_from_slice(js[wrapstart..wrapend].as_bytes());

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

		buffer.extend_from_slice(js[offset..].as_bytes());

		JsChangeResult {
			js: buffer,
			sourcemap: map,
		}
	}
}

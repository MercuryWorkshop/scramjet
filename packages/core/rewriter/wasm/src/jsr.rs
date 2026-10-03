use std::error::Error;

use js::{
	RewriteResult, Rewriter,
	cfg::{Config, Flags, UrlRewriter},
};
use js_sys::{Function, Object, Uint8Array, encode_uri_component};
use oxc::allocator::StringBuilder;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};
use web_sys::Url;

use crate::{
	error::{Result, RewriterError},
	 get_obj, get_str, set_obj,
};

// slightly modified https://github.com/ungap/random-uuid/blob/main/index.js
#[wasm_bindgen(inline_js = r#"
export function scramtag() {
    return (""+1e10).replace(/[018]/g,
      c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
"#)]
extern "C" {
	pub fn scramtag() -> std::string::String;
}

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
export type JsRewriterOutput = {
	js: Uint8Array,
	map: Uint8Array,
	scramtag: string,
	errors: string[],
};
"#;

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(typescript_type = "JsRewriterOutput")]
	pub type JsRewriterOutput;
}


pub struct WasmUrlRewriter(Function);

impl UrlRewriter for WasmUrlRewriter {
	fn rewrite(
		&self,
		_cfg: &Config,
		flags: &Flags,
		url: &str,
		builder: &mut StringBuilder,
		module: bool,
	) -> std::result::Result<(), Box<dyn Error + Sync + Send>> {
		let url: std::string::String = Url::new_with_base(url, &flags.base)
			.map_err(RewriterError::from)?
			.href();

		// the fragment goes after the query, as it was written, the same way
		// `rewriteUrl` puts it - so `import "./m.js#a"` and `import("./m.js#a")`
		// load the one module, as they do natively. A module's identity is its
		// URL fragment and all. The serializer percent-encodes every other `#`,
		// so the first is the delimiter
		let (without_fragment, fragment) = match url.find('#') {
			Some(index) => url.split_at(index),
			None => (url.as_str(), ""),
		};

		let mut rewritten = self
			.0
			.call1(&JsValue::NULL, &without_fragment.into())
			.map_err(RewriterError::from)?
			.as_string()
			.ok_or_else(|| RewriterError::not_str("url rewriter output"))?;

		if module {
			// TODO: keep this in sync with QP.isModule or find a way to make this use the real rewriteUrl function
			let origin = Url::new(&flags.base).map_err(RewriterError::from)?.origin();
			let encoded_origin: String = encode_uri_component(&origin).into();
			rewritten.push_str("?%24module=module&%24io=");
			rewritten.push_str(&encoded_origin);
		}

		// back inside the string literal it came out of. The fragment
		// percent-encode set covers `"`, line terminators and everything
		// outside ASCII, but leaves `\` and `'`
		rewritten.push_str(&js::cfg::escape_js_string(fragment));

		builder.push_str(&rewritten);

		Ok(())
	}
}

pub type JsRewriter = Rewriter;

pub fn create_js() -> Result<JsRewriter> {
	Ok(Rewriter::new())
}

pub fn get_url_rewriter(func: Object) -> Result<WasmUrlRewriter> {
	Ok(WasmUrlRewriter(
		func
			.dyn_into()
			.map_err(|_| RewriterError::not_fn("scramjet.codec.encode"))?,
	))
}

pub fn create_js_output(out: RewriteResult, url: String, src: String) -> Result<JsRewriterOutput> {
	let obj = Object::new();
	set_obj(&obj, "js", &Uint8Array::from(out.js.as_slice()).into())?;
	set_obj(
		&obj,
		"map",
		&Uint8Array::from(out.sourcemap.as_slice()).into(),
	)?;
	set_obj(&obj, "scramtag", &out.flags.sourcetag.into())?;

	#[cfg(feature = "debug")]
	{
		let src = std::sync::Arc::new(
			oxc::diagnostics::NamedSource::new(url, src).with_language("javascript"),
		);
		let errs: Vec<_> = out
			.errors
			.into_iter()
			.map(|x| format!("{}", x.with_source_code(src.clone())))
			.collect();
		set_obj(&obj, "errors", &errs.into())?;
	}
	#[cfg(not(feature = "debug"))]
	{
		let _ = (url, src);
		set_obj(&obj, "errors", &js_sys::Array::new())?;
	}

	Ok(JsRewriterOutput::from(JsValue::from(obj)))
}

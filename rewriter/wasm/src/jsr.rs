use std::error::Error;

use js::{
	RewriteResult, Rewriter,
	cfg::{Config, Flags, UrlRewriter},
};
use js_sys::{Function, Object, Uint8Array};
use oxc::allocator::StringBuilder;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};
use web_sys::Url;

use crate::{
	error::{Result, RewriterError},
	get_flag, get_obj, get_str, set_obj,
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

fn get_config(scramjet: &Object) -> Result<Config> {
	let config = &get_obj(scramjet, "config")?;
	let globals = &get_obj(config, "globals")?;

	Ok(Config {
		prefix: get_str(config, "prefix")?,

		wrapfn: get_str(globals, "wrapfn")?,
		wrapthisfn: get_str(globals, "wrapthisfn")?,
		importfn: get_str(globals, "importfn")?,
		rewritefn: get_str(globals, "rewritefn")?,
		metafn: get_str(globals, "metafn")?,
		setrealmfn: get_str(globals, "setrealmfn")?,
		pushsourcemapfn: get_str(globals, "pushsourcemapfn")?,
	})
}

pub struct WasmUrlRewriter(Function);

impl UrlRewriter for WasmUrlRewriter {
	fn rewrite(
		&self,
		_cfg: &Config,
		flags: &Flags,
		url: &str,
		builder: &mut StringBuilder,
	) -> std::result::Result<(), Box<dyn Error + Sync + Send>> {
		let url = Url::new_with_base(url, &flags.base)
			.map_err(RewriterError::from)?
			.to_string();

		builder.push_str(
			self.0
				.call1(&JsValue::NULL, &url.into())
				.map_err(RewriterError::from)?
				.as_string()
				.ok_or_else(|| RewriterError::not_str("url rewriter output"))?
				.as_str(),
		);

		Ok(())
	}
}

fn get_url_rewriter(scramjet: &Object) -> Result<WasmUrlRewriter> {
	let codec = &get_obj(scramjet, "codec")?;
	Ok(WasmUrlRewriter(
		get_obj(codec, "encode")?
			.dyn_into()
			.map_err(|_| RewriterError::not_fn("scramjet.codec.encode"))?,
	))
}

pub type JsRewriter = Rewriter<WasmUrlRewriter>;

pub fn create_js(scramjet: &Object) -> Result<JsRewriter> {
	let cfg = get_config(scramjet)?;
	let url_rewriter = get_url_rewriter(scramjet)?;

	Ok(Rewriter::new(cfg, url_rewriter))
}

pub fn get_js_flags(scramjet: &Object, base: String, is_module: bool) -> Result<Flags> {
	Ok(Flags {
		is_module,
		sourcetag: scramtag(),

		do_sourcemaps: get_flag(scramjet, &base, "sourcemaps")?,
		capture_errors: get_flag(scramjet, &base, "captureErrors")?,
		scramitize: get_flag(scramjet, &base, "scramitize")?,
		strict_rewrites: get_flag(scramjet, &base, "strictRewrites")?,

		base,
	})
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

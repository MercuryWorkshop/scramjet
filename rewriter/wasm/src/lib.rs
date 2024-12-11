pub mod error;

use std::{str::FromStr, sync::Arc, time::Duration};

use error::{Result, RewriterError};
use instant::Instant;
use js_sys::{Function, Object, Reflect};
use oxc::diagnostics::NamedSource;
use rewriter::{cfg::Config, rewrite, RewriteResult};
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
type RewriterOutput = { js: Uint8Array, errors: string[], duration: bigint };
"#;

#[wasm_bindgen(inline_js = r#"
// slightly modified https://github.com/ungap/random-uuid/blob/main/index.js
export function scramtag() {
    return (""+1e10).replace(/[018]/g,
      c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
"#)]
extern "C" {
	pub fn scramtag() -> String;
}

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(typescript_type = "RewriterOutput")]
	pub type JsRewriterOutput;
}

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = console)]
	fn error(s: &str);
}

fn create_encode_function(encode: JsValue) -> Result<impl Fn(String) -> String + Clone> {
	let encode = encode.dyn_into::<Function>()?;

	Ok(move |str: String| {
		encode
			.call1(&JsValue::NULL, &str.into())
			.unwrap()
			.as_string()
			.unwrap()
			.to_string()
	})
}

fn get_obj(obj: &JsValue, k: &str) -> Result<JsValue> {
	Ok(Reflect::get(obj, &k.into())?)
}

fn get_str(obj: &JsValue, k: &str) -> Result<String> {
	Reflect::get(obj, &k.into())?
		.as_string()
		.ok_or_else(|| RewriterError::not_str(k))
}

fn set_obj(obj: &Object, k: &str, v: &JsValue) -> Result<()> {
	if !Reflect::set(&obj.into(), &k.into(), v)? {
		Err(RewriterError::ReflectSetFail(k.to_string()))
	} else {
		Ok(())
	}
}

fn get_flag(scramjet: &Object, url: &str, flag: &str) -> Result<bool> {
	let fenabled = get_obj(scramjet, "flagEnabled")?
		.dyn_into::<Function>()
		.map_err(|_| RewriterError::not_fn("scramjet.flagEnabled"))?;
	let ret = fenabled.call2(
		&JsValue::NULL,
		&flag.into(),
		&web_sys::Url::new(url)?.into(),
	)?;

	ret.as_bool()
		.ok_or_else(|| RewriterError::not_bool("scramjet.flagEnabled return value"))
}

fn get_config(scramjet: &Object, url: &str) -> Result<Config<impl Fn(String) -> String + Clone>> {
	let codec = &get_obj(scramjet, "codec")?;
	let config = &get_obj(scramjet, "config")?;
	let globals = &get_obj(config, "globals")?;

	Ok(Config {
		prefix: get_str(config, "prefix")?,
		encoder: create_encode_function(get_obj(codec, "encode")?)?,
		base: Url::from_str(url)?,
		sourcetag: scramtag(),

		wrapfn: get_str(globals, "wrapfn")?,
		wrapthisfn: get_str(globals, "wrapthisfn")?,
		importfn: get_str(globals, "importfn")?,
		rewritefn: get_str(globals, "rewritefn")?,
		metafn: get_str(globals, "metafn")?,
		setrealmfn: get_str(globals, "setrealmfn")?,
		pushsourcemapfn: get_str(globals, "pushsourcemapfn")?,

		do_sourcemaps: get_flag(scramjet, url, "sourcemaps")?,
		capture_errors: get_flag(scramjet, url, "captureErrors")?,
		scramitize: get_flag(scramjet, url, "scramitize")?,
		strict_rewrites: get_flag(scramjet, url, "strictRewrites")?,
	})
}

fn duration_to_millis_f64(duration: Duration) -> f64 {
	(duration.as_secs() as f64) * 1_000f64 + (duration.subsec_nanos() as f64) / 1_000_000f64
}

fn create_rewriter_output(
	out: RewriteResult,
	url: String,
	src: String,
	duration: Duration,
) -> Result<JsRewriterOutput> {
	let src = Arc::new(NamedSource::new(url, src).with_language("javascript"));
	#[cfg(feature = "debug")]
	let errs: Vec<_> = out
		.errors
		.into_iter()
		.map(|x| format!("{}", x.with_source_code(src.clone())))
		.collect();

	let obj = Object::new();
	set_obj(&obj, "js", &out.js.into())?;
	#[cfg(feature = "debug")]
	set_obj(&obj, "errors", &errs.into())?;
	#[cfg(not(feature = "debug"))]
	set_obj(&obj, "errors", &js_sys::Array::new())?;
	set_obj(&obj, "duration", &duration_to_millis_f64(duration).into())?;

	Ok(JsRewriterOutput::from(JsValue::from(obj)))
}

#[wasm_bindgen]
pub fn rewrite_js(
	js: String,
	url: &str,
	script_url: String,
	scramjet: &Object,
) -> Result<JsRewriterOutput> {
	let before = Instant::now();
	let out = rewrite(&js, get_config(scramjet, url)?)?;
	let after = Instant::now();

	create_rewriter_output(out, script_url, js, after - before)
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(
	js: Vec<u8>,
	url: &str,
	script_url: String,
	scramjet: &Object,
) -> Result<JsRewriterOutput> {
	// we know that this is a valid utf-8 string
	let js = unsafe { String::from_utf8_unchecked(js) };

	let before = Instant::now();
	let out = rewrite(&js, get_config(scramjet, url)?)?;
	let after = Instant::now();

	create_rewriter_output(out, script_url, js, after - before)
}

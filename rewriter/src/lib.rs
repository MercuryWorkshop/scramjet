pub mod error;
pub mod rewrite;

use std::{panic, str::FromStr, sync::Arc, time::Duration};

use error::{Result, RewriterError};
use instant::Instant;
use js_sys::{Function, Object, Reflect};
use oxc::diagnostics::{NamedSource, OxcDiagnostic};
use rewrite::{rewrite, Config, EncodeFn};
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
type RewriterOutput = { js: Uint8Array, errors: string[], duration: bigint };
"#;

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(typescript_type = "RewriterOutput")]
	pub type RewriterOutput;
}

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = console)]
	fn error(s: &str);
}

#[wasm_bindgen]
pub fn init() {
	panic::set_hook(Box::new(console_error_panic_hook::hook));
}

fn create_encode_function(encode: JsValue) -> Result<EncodeFn> {
	let encode = encode.dyn_into::<Function>()?;

	Ok(Box::new(move |str| {
		encode
			.call1(&JsValue::NULL, &str.into())
			.unwrap()
			.as_string()
			.unwrap()
			.to_string()
	}))
}

fn get_obj(obj: &JsValue, k: &str) -> Result<JsValue> {
	Ok(Reflect::get(obj, &k.into())?)
}

fn get_str(obj: &JsValue, k: &str) -> Result<String> {
	Reflect::get(obj, &k.into())?
		.as_string()
		.ok_or_else(|| RewriterError::not_str(k, obj))
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
		.map_err(RewriterError::not_fn)?;
	let ret = fenabled.call2(
		&JsValue::NULL,
		&flag.into(),
		&web_sys::Url::new(url).expect("invalid url").into(),
	)?;

	ret.as_bool().ok_or_else(|| RewriterError::not_bool(&ret))
}

fn get_config(scramjet: &Object, url: &str) -> Result<Config> {
	let codec = &get_obj(scramjet, "codec")?;
	let config = &get_obj(scramjet, "config")?;
	let globals = &get_obj(config, "globals")?;

	Ok(Config {
		prefix: get_str(config, "prefix")?,
		encode: create_encode_function(get_obj(codec, "encode")?)?,

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

#[cfg(feature = "drm")]
#[inline(always)]
fn drmcheck() -> bool {
	use js_sys::global;
	use obfstr::obfstr;

	let true_origin = get_str(&get_obj(&global(), obfstr!("location")), obfstr!("origin"));
	return vec![obfstr!("http://localhost:1337")].contains(&true_origin.as_str());
}

fn duration_to_millis_f64(duration: Duration) -> f64 {
	(duration.as_secs() as f64) * 1_000f64 + (duration.subsec_nanos() as f64) / 1_000_000f64
}

fn create_rewriter_output(
	out: (Vec<u8>, Vec<OxcDiagnostic>),
	url: String,
	src: String,
	duration: Duration,
) -> Result<RewriterOutput> {
	let src = Arc::new(NamedSource::new(url, src).with_language("javascript"));
	let errs: Vec<_> = out
		.1
		.into_iter()
		.map(|x| format!("{:?}", x.with_source_code(src.clone())))
		.collect();

	let obj = Object::new();
	set_obj(&obj, "js", &out.0.into())?;
	set_obj(&obj, "errors", &errs.into())?;
	set_obj(&obj, "duration", &duration_to_millis_f64(duration).into())?;

	Ok(RewriterOutput::from(JsValue::from(obj)))
}

#[wasm_bindgen]
pub fn rewrite_js(
	js: String,
	url: &str,
	script_url: String,
	scramjet: &Object,
) -> Result<RewriterOutput> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	let before = Instant::now();
	let out = rewrite(&js, Url::from_str(url)?, get_config(scramjet, url)?)?;
	let after = Instant::now();

	create_rewriter_output(out, script_url, js, after - before)
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(
	js: Vec<u8>,
	url: &str,
	script_url: String,
	scramjet: &Object,
) -> Result<RewriterOutput> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	// we know that this is a valid utf-8 string
	let js = unsafe { String::from_utf8_unchecked(js) };

	let before = Instant::now();
	let out = rewrite(&js, Url::from_str(url)?, get_config(scramjet, url)?)?;
	let after = Instant::now();

	create_rewriter_output(out, script_url, js, after - before)
}

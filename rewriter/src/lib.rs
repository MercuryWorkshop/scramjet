pub mod error;
pub mod rewrite;

use std::{panic, str::FromStr};

use error::{Result, RewriterError};
use js_sys::{Function, Object, Reflect};
use rewrite::{rewrite, Config, EncodeFn};
use url::Url;
use wasm_bindgen::prelude::*;

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

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str, scramjet: &Object) -> Result<Vec<u8>> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	rewrite(js, Url::from_str(url)?, get_config(scramjet, url)?)
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str, scramjet: &Object) -> Result<Vec<u8>> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	// we know that this is a valid utf-8 string
	let js = unsafe { std::str::from_utf8_unchecked(js) };

	rewrite(js, Url::from_str(url)?, get_config(scramjet, url)?)
}

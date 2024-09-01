pub mod rewrite;

use std::{panic, str::FromStr};

use js_sys::{Function, Object, Reflect};
use rewrite::{rewrite, Config, EncodeFn};
use url::Url;
use wasm_bindgen::{prelude::*, throw_str};

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = console)]
	fn log(s: &str);
}

#[wasm_bindgen]
pub fn init() {
	panic::set_hook(Box::new(console_error_panic_hook::hook));
}

fn create_encode_function(encode: JsValue) -> EncodeFn {
	let Ok(encode) = encode.dyn_into::<Function>() else {
		throw_str("invalid encode function");
	};

	Box::new(move |str| {
		encode
			.call1(&JsValue::NULL, &str.into())
			.unwrap()
			.as_string()
			.unwrap()
			.to_string()
	})
}

fn get_obj(obj: &JsValue, k: &str) -> JsValue {
	Reflect::get(obj, &k.into()).unwrap()
}

fn get_bool(obj: &JsValue, k: &str) -> bool {
	Reflect::get(obj, &k.into()).unwrap().as_bool().unwrap()
}

fn get_str(obj: &JsValue, k: &str) -> String {
	Reflect::get(obj, &k.into()).unwrap().as_string().unwrap()
}

fn get_config(scramjet: &Object) -> Config {
	let codec = &get_obj(scramjet, "codec");
	let config = &get_obj(scramjet, "config");
	let flags = &get_obj(config, "flags");

	Config {
		prefix: get_str(config, "prefix"),
		encode: create_encode_function(get_obj(codec, "encode")),

		wrapfn: get_str(config, "wrapfn"),
		importfn: get_str(config, "importfn"),
		rewritefn: get_str(config, "rewritefn"),
		metafn: get_str(config, "metafn"),
		setrealmfn: get_str(config, "setrealmfn"),
		pushsourcemapfn: get_str(config, "pushsourcemapfn"),

		do_sourcemaps: get_bool(flags, "sourcemaps"),
		capture_errors: get_bool(flags, "captureErrors"),
	}
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
pub fn rewrite_js(js: &str, url: &str, scramjet: &Object) -> Vec<u8> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	rewrite(js, Url::from_str(url).unwrap(), get_config(scramjet))
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str, scramjet: &Object) -> Vec<u8> {
	#[cfg(feature = "drm")]
	if !drmcheck() {
		return Vec::new();
	}

	// we know that this is a valid utf-8 string
	let js = unsafe { std::str::from_utf8_unchecked(js) };

	rewrite(js, Url::from_str(url).unwrap(), get_config(scramjet))
}

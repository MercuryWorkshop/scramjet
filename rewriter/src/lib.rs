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

fn get_str(config: &Object, k: &str) -> String {
	Reflect::get(config, &k.into())
		.unwrap()
		.as_string()
		.unwrap()
}

fn get_config(config: Object) -> Config {
	Config {
		prefix: get_str(&config, "prefix"),
		encode: create_encode_function(Reflect::get(&config, &"encode".into()).unwrap()),
		wrapfn: get_str(&config, "wrapfn"),
		importfn: get_str(&config, "importfn"),
		rewritefn: get_str(&config, "rewritefn"),
	}
}

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str, config: Object) -> Vec<u8> {
	rewrite(js, Url::from_str(url).unwrap(), get_config(config))
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str, config: Object) -> Vec<u8> {
	// we know that this is a valid utf-8 string
	let js = unsafe { std::str::from_utf8_unchecked(js) };

	rewrite(js, Url::from_str(url).unwrap(), get_config(config))
}

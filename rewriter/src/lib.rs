pub mod rewrite;

use std::{panic, str::FromStr};

use js_sys::Function;
use rewrite::{rewrite, EncodeFn};
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
}

fn create_encode_function(encode: Function) -> EncodeFn {
    Box::new(move |str| {
        encode
            .call1(&JsValue::NULL, &str.into())
            .unwrap()
            .as_string()
            .unwrap()
            .to_string()
    })
}

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str, encode: Function) -> Vec<u8> {
    rewrite(
        js,
        Url::from_str(url).unwrap(),
        create_encode_function(encode),
    )
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str, encode: Function) -> Vec<u8> {
    // technically slower than the c++ string conversion but it will create *less copies*

    let js = unsafe { std::str::from_utf8_unchecked(js) };

    rewrite(
        js,
        Url::from_str(url).unwrap(),
        create_encode_function(encode),
    )
}

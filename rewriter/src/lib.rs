pub mod rewrite;

use std::{
    panic,
    str::{from_utf8, FromStr},
};

use js_sys::Uint8Array;
use rewrite::rewrite;
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

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str) -> Vec<u8> {
    rewrite(js, Url::from_str(url).unwrap())
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str) -> Vec<u8> {
    // technically slower than the c++ string conversion but it will create *less copies*

    let js = unsafe { std::str::from_utf8_unchecked(js) };

    rewrite(js, Url::from_str(url).unwrap())
}

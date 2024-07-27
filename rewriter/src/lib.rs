pub mod rewrite;

use std::{panic, str::FromStr};

use js_sys::encode_uri_component;
use rewrite::rewrite;
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// import the SCRAM!!! jet encoder here later
fn encode(s: String) -> String {
    encode_uri_component(&s).into()
}

#[wasm_bindgen]
pub fn init() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str) -> Vec<u8> {
    rewrite(js, Url::from_str(url).unwrap(), Box::new(encode))
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str) -> Vec<u8> {
    // technically slower than the c++ string conversion but it will create *less copies*

    let js = unsafe { std::str::from_utf8_unchecked(js) };

    rewrite(js, Url::from_str(url).unwrap(), Box::new(encode))
}

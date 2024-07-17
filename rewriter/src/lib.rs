pub mod rewrite;

use std::str::FromStr;

use rewrite::rewrite;
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn rewrite_js(js: &str, url: &str) -> String {
    rewrite(js, Url::from_str(url).unwrap())
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(js: &[u8], url: &str) -> String {
    // technically slower than the c++ string conversion but it will create *less copies*

    let js = unsafe { std::str::from_utf8_unchecked(js) };

    rewrite(js, Url::from_str(url).unwrap())
}

pub mod rewrite;

use rewrite::rewrite;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn rewrite_js(js: &str) -> String {
    log("hello from rust");

    rewrite(js)
}

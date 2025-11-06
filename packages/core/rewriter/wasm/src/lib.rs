pub mod error;

use error::{Result, RewriterError};
use js::cfg::{Config, Flags};
use js_sys::{Function, Object, Reflect};
use jsr::{JsRewriter, JsRewriterOutput, create_js, create_js_output};
use oxc::allocator::Allocator;
use wasm_bindgen::prelude::*;
use web_sys::Url;

use crate::jsr::{WasmUrlRewriter, get_url_rewriter, scramtag};

mod jsr;

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = console, js_name = error)]
	fn console_error(s: &str);
	#[wasm_bindgen(js_namespace = console, js_name = error)]
	fn console_error2(s: &JsValue);
}

fn get_obj(obj: &JsValue, k: &'static str) -> Result<JsValue> {
	Ok(Reflect::get(obj, &k.into())?)
}

fn get_str(obj: &JsValue, k: &'static str) -> Result<String> {
	Reflect::get(obj, &k.into())?
		.as_string()
		.ok_or_else(|| RewriterError::not_str(k))
}
fn get_bool(obj: &JsValue, k: &'static str) -> Result<bool> {
	Reflect::get(obj, &k.into())?
		.as_bool()
		.ok_or_else(|| RewriterError::not_bool(k))
}

fn set_obj(obj: &Object, k: &str, v: &JsValue) -> Result<()> {
	if Reflect::set(&obj.into(), &k.into(), v)? {
		Ok(())
	} else {
		Err(RewriterError::ReflectSetFail(k.to_string()))
	}
}

fn get_js_config(config: &Object) -> Result<Config> {
	Ok(Config {
		prefix: get_str(config, "prefix")?,

		wrapfn: get_str(config, "wrapfn")?,
		wrappropertybase: get_str(config, "wrappropertybase")?,
		wrappropertyfn: get_str(config, "wrappropertyfn")?,
		cleanrestfn: get_str(config, "cleanrestfn")?,
		importfn: get_str(config, "importfn")?,
		rewritefn: get_str(config, "rewritefn")?,
		wrappostmessagefn: get_str(config, "wrappostmessagefn")?,
		metafn: get_str(config, "metafn")?,
		pushsourcemapfn: get_str(config, "pushsourcemapfn")?,

		trysetfn: get_str(config, "trysetfn")?,
		templocid: get_str(config, "templocid")?,
		tempunusedid: get_str(config, "tempunusedid")?,
	})
}

fn get_js_flags(obj: &Object, base: String, is_module: bool) -> Result<Flags> {
	Ok(Flags {
		is_module,

		sourcetag: scramtag(),

		do_sourcemaps: get_bool(obj, "sourcemaps")?,
		capture_errors: get_bool(obj, "captureErrors")?,
		scramitize: get_bool(obj, "scramitize")?,
		strict_rewrites: get_bool(obj, "strictRewrites")?,
		destructure_rewrites: get_bool(obj, "destructureRewrites")?,

		base,
	})
}

#[wasm_bindgen]
pub struct Rewriter {
	alloc: Allocator,

	scramjet: Object,
	js: JsRewriter,
}

#[wasm_bindgen]
impl Rewriter {
	#[wasm_bindgen(constructor)]
	pub fn new(scramjet: Object) -> Result<Self> {
		Ok(Self {
			alloc: Allocator::default(),

			js: create_js()?,
			scramjet,
		})
	}

	#[wasm_bindgen]
	pub fn rewrite_js(
		&mut self,
		jsconfig: &Object,
		jsflags: &Object,
		encode_url: Object,
		js: String,
		base: String,
		url: String,
		module: bool,
	) -> Result<JsRewriterOutput> {
		let config = get_js_config(jsconfig)?;
		let flags = get_js_flags(jsflags, base, module)?;
		let rewriter = get_url_rewriter(encode_url)?;

		let out = match self.js.rewrite(&self.alloc, &js, config, flags, &rewriter) {
			Ok(x) => x,
			Err(x) => {
				self.alloc.reset();
				Err(x)?
			}
		};

		let ret = create_js_output(out, url, js);

		self.alloc.reset();
		ret
	}

	#[wasm_bindgen]
	pub fn rewrite_js_bytes(
		&mut self,
		jsconfig: &Object,
		jsflags: &Object,
		encode_url: Object,
		js: Vec<u8>,
		base: String,
		url: String,
		module: bool,
	) -> Result<JsRewriterOutput> {
		// SAFETY: we know the js is a valid utf-8 string
		let js = unsafe { std::string::String::from_utf8_unchecked(js) };

		self.rewrite_js(jsconfig, jsflags, encode_url, js, base, url, module)
	}

}

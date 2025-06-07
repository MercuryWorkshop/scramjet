pub mod error;

use error::{Result, RewriterError};
use htmlr::{HtmlRewriter, HtmlRewriterOutput, create_html, create_html_output};
use js_sys::{Function, Object, Reflect};
use jsr::{JsRewriter, JsRewriterOutput, create_js, create_js_output, get_js_flags};
use oxc::allocator::Allocator;
use wasm_bindgen::prelude::*;
use web_sys::Url;

mod htmlr;
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

fn set_obj(obj: &Object, k: &str, v: &JsValue) -> Result<()> {
	if Reflect::set(&obj.into(), &k.into(), v)? {
		Ok(())
	} else {
		Err(RewriterError::ReflectSetFail(k.to_string()))
	}
}

fn get_flag(scramjet: &Object, url: &str, flag: &str) -> Result<bool> {
	let fenabled = get_obj(scramjet, "flagEnabled")?
		.dyn_into::<Function>()
		.map_err(|_| RewriterError::not_fn("scramjet.flagEnabled"))?;
	let ret = fenabled.call2(&JsValue::NULL, &flag.into(), &Url::new(url)?.into())?;

	ret.as_bool()
		.ok_or_else(|| RewriterError::not_bool("scramjet.flagEnabled return value"))
}

#[wasm_bindgen]
pub struct Rewriter {
	alloc: Allocator,

	scramjet: Object,
	js: JsRewriter,
	html: HtmlRewriter,
}

#[wasm_bindgen]
impl Rewriter {
	#[wasm_bindgen(constructor)]
	pub fn new(scramjet: Object) -> Result<Self> {
		Ok(Self {
			alloc: Allocator::default(),

			js: create_js(&scramjet)?,
			html: create_html(&scramjet)?,
			scramjet,
		})
	}

	#[wasm_bindgen]
	pub fn rewrite_js(
		&mut self,
		js: String,
		base: String,
		url: String,
		module: bool,
	) -> Result<JsRewriterOutput> {
		let flags = get_js_flags(&self.scramjet, base, module)?;

		let out = match self.js.rewrite(&self.alloc, &js, flags) {
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
		js: Vec<u8>,
		base: String,
		url: String,
		module: bool,
	) -> Result<JsRewriterOutput> {
		// SAFETY: we know the js is a valid utf-8 string
		let js = unsafe { std::string::String::from_utf8_unchecked(js) };

		self.rewrite_js(js, base, url, module)
	}

	#[wasm_bindgen]
	pub fn rewrite_html(&mut self, html: String, meta: Object, cookie: Object) -> Result<HtmlRewriterOutput> {
		let out = match self.html.rewrite(&self.alloc, &html, &(meta, cookie)) {
			Ok(x) => x,
			Err(x) => {
				self.alloc.reset();
				Err(x)?
			}
		};

		let ret = create_html_output(out);

		self.alloc.reset();
		ret
	}
}

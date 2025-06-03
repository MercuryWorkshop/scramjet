pub mod error;

use error::{Result, RewriterError};
use js::{
	cfg::{Config, Flags, UrlRewriter},
	RewriteResult, Rewriter as JsRewriter,
};
use js_sys::{Function, Object, Reflect, Uint8Array};
use oxc::allocator::{Allocator, StringBuilder};
use wasm_bindgen::prelude::*;
use web_sys::Url;

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
export type RewriterOutput = { 
	js: Uint8Array,
	map: Uint8Array,
	scramtag: string,
	errors: string[],
};
"#;

// slightly modified https://github.com/ungap/random-uuid/blob/main/index.js
#[wasm_bindgen(inline_js = r#"
export function scramtag() {
    return (""+1e10).replace(/[018]/g,
      c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
"#)]
extern "C" {
	pub fn scramtag() -> std::string::String;
}

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(typescript_type = "RewriterOutput")]
	pub type JsRewriterOutput;

	#[wasm_bindgen(js_namespace = console)]
	fn error(s: &str);
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

fn get_config(scramjet: &Object) -> Result<Config> {
	let config = &get_obj(scramjet, "config")?;
	let globals = &get_obj(config, "globals")?;

	Ok(Config {
		prefix: get_str(config, "prefix")?,

		wrapfn: get_str(globals, "wrapfn")?,
		wrapthisfn: get_str(globals, "wrapthisfn")?,
		importfn: get_str(globals, "importfn")?,
		rewritefn: get_str(globals, "rewritefn")?,
		metafn: get_str(globals, "metafn")?,
		setrealmfn: get_str(globals, "setrealmfn")?,
		pushsourcemapfn: get_str(globals, "pushsourcemapfn")?,
	})
}

fn get_rewriter(scramjet: &Object) -> Result<WasmUrlRewriter> {
	let codec = &get_obj(scramjet, "codec")?;
	Ok(WasmUrlRewriter(
		get_obj(codec, "encode")?
			.dyn_into()
			.map_err(|_| RewriterError::not_fn("scramjet.codec.encode"))?,
	))
}

fn get_flags(scramjet: &Object, base: String, is_module: bool) -> Result<Flags> {
	Ok(Flags {
		is_module,
		sourcetag: scramtag(),

		do_sourcemaps: get_flag(scramjet, &base, "sourcemaps")?,
		capture_errors: get_flag(scramjet, &base, "captureErrors")?,
		scramitize: get_flag(scramjet, &base, "scramitize")?,
		strict_rewrites: get_flag(scramjet, &base, "strictRewrites")?,

		base,
	})
}

struct WasmUrlRewriter(Function);

impl UrlRewriter for WasmUrlRewriter {
	fn rewrite(&self, _cfg: &Config, flags: &Flags, url: &str, builder: &mut StringBuilder) {
		let url = Url::new_with_base(url, &flags.base).unwrap().to_string();
		builder.push_str(
			self.0
				.call1(&JsValue::NULL, &url.into())
				.unwrap()
				.as_string()
				.unwrap()
				.as_str(),
		);
	}
}

#[wasm_bindgen]
pub struct Rewriter {
	alloc: Allocator,

	scramjet: Object,
	js: JsRewriter<WasmUrlRewriter>,
}

#[wasm_bindgen]
impl Rewriter {
	#[wasm_bindgen(constructor)]
	pub fn new(scramjet: Object) -> Result<Self> {
		let js_config = get_config(&scramjet)?;
		let url_rewriter = get_rewriter(&scramjet)?;

		Ok(Self {
			alloc: Allocator::default(),

			scramjet,
			js: JsRewriter::new(js_config, url_rewriter),
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
		let flags = get_flags(&self.scramjet, base, module)?;

		let out = self.js.rewrite(&self.alloc, &js, flags)?;

		let ret = create_rewriter_output(out, url, js);

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
}

fn create_rewriter_output(
	out: RewriteResult,
	url: String,
	src: String,
) -> Result<JsRewriterOutput> {
	let obj = Object::new();
	set_obj(&obj, "js", &Uint8Array::from(out.js.as_slice()).into())?;
	set_obj(
		&obj,
		"map",
		&Uint8Array::from(out.sourcemap.as_slice()).into(),
	)?;
	set_obj(&obj, "scramtag", &out.flags.sourcetag.into())?;

	#[cfg(feature = "debug")]
	{
		let src = std::sync::Arc::new(
			oxc::diagnostics::NamedSource::new(url, src).with_language("javascript"),
		);
		let errs: Vec<_> = out
			.errors
			.into_iter()
			.map(|x| format!("{}", x.with_source_code(src.clone())))
			.collect();
		set_obj(&obj, "errors", &errs.into())?;
	}
	#[cfg(not(feature = "debug"))]
	{
		let _ = (url, src);
		set_obj(&obj, "errors", &js_sys::Array::new())?;
	}

	Ok(JsRewriterOutput::from(JsValue::from(obj)))
}

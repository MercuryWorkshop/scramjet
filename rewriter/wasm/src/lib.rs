pub mod error;

use std::{cell::RefCell, sync::Arc, time::Duration};

use error::{Result, RewriterError};
use instant::Instant;
use js::{cfg::Config, rewrite, RewriteResult};
use js_sys::{Function, Object, Reflect, Uint8Array};
use oxc::{
	allocator::{Allocator, StringBuilder},
	diagnostics::NamedSource,
};
use wasm_bindgen::prelude::*;
use web_sys::Url;

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
type RewriterOutput = { 
	js: Uint8Array,
	map: Uint8Array,
	scramtag: string,
	errors: string[],
	duration: bigint
};
"#;

#[wasm_bindgen(inline_js = r#"
// slightly modified https://github.com/ungap/random-uuid/blob/main/index.js
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

thread_local! {
	static ALLOC: RefCell<Allocator> = RefCell::new(Allocator::default());
}

type EncodeFn<'alloc, 'data> = Box<dyn for<'a, 'b> Fn(&'a str, &'b mut StringBuilder<'alloc>) + 'data>;

fn create_encode_function<'alloc, 'data>(
	encode: JsValue,
	base: &'data str,
	_alloc: &'alloc Allocator,
) -> Result<EncodeFn<'alloc, 'data>> {
	let encode = encode.dyn_into::<Function>()?;

	let func = move |url: &str, builder: &mut StringBuilder<'alloc>| {
		let url = Url::new_with_base(url, base).unwrap().to_string();
		builder.push_str(
			encode
				.call1(&JsValue::NULL, &url.into())
				.unwrap()
				.as_string()
				.unwrap()
				.as_str(),
		);
	};

	Ok(Box::new(func))
}

fn get_obj(obj: &JsValue, k: &str) -> Result<JsValue> {
	Ok(Reflect::get(obj, &k.into())?)
}

fn get_str<'alloc>(obj: &JsValue, k: &str, alloc: &'alloc Allocator) -> Result<&'alloc str> {
	Reflect::get(obj, &k.into())?
		.as_string()
		.ok_or_else(|| RewriterError::not_str(k))
		.map(|x| StringBuilder::from_str_in(&x, alloc).into_str())
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

fn get_config<'alloc, 'data>(
	scramjet: &Object,
	url: &'data str,
	alloc: &'alloc Allocator,
) -> Result<Config<'alloc, EncodeFn<'alloc, 'data>>> {
	let codec = &get_obj(scramjet, "codec")?;
	let config = &get_obj(scramjet, "config")?;
	let globals = &get_obj(config, "globals")?;

	Ok(Config {
		do_sourcemaps: get_flag(scramjet, url, "sourcemaps")?,
		capture_errors: get_flag(scramjet, url, "captureErrors")?,
		scramitize: get_flag(scramjet, url, "scramitize")?,
		strict_rewrites: get_flag(scramjet, url, "strictRewrites")?,

		urlrewriter: create_encode_function(get_obj(codec, "encode")?, url, alloc)?,

		prefix: get_str(config, "prefix", alloc)?,
		base: StringBuilder::from_str_in(url, alloc).into_str(),
		sourcetag: StringBuilder::from_str_in(&scramtag(), alloc).into_str(),

		wrapfn: get_str(globals, "wrapfn", alloc)?,
		wrapthisfn: get_str(globals, "wrapthisfn", alloc)?,
		importfn: get_str(globals, "importfn", alloc)?,
		rewritefn: get_str(globals, "rewritefn", alloc)?,
		metafn: get_str(globals, "metafn", alloc)?,
		setrealmfn: get_str(globals, "setrealmfn", alloc)?,
		pushsourcemapfn: get_str(globals, "pushsourcemapfn", alloc)?,
	})
}

#[allow(clippy::cast_precision_loss, clippy::cast_lossless)]
fn duration_to_millis_f64(duration: Duration) -> f64 {
	(duration.as_secs() as f64) * 1_000f64 + (duration.subsec_nanos() as f64) / 1_000_000f64
}

fn create_rewriter_output(
	out: RewriteResult,
	url: std::string::String,
	src: std::string::String,
	sourcetag: &str,
	duration: Duration,
) -> Result<JsRewriterOutput> {
	let src = Arc::new(NamedSource::new(url, src).with_language("javascript"));
	#[cfg(feature = "debug")]
	let errs: Vec<_> = out
		.errors
		.into_iter()
		.map(|x| format!("{}", x.with_source_code(src.clone())))
		.collect();

	let obj = Object::new();
	set_obj(&obj, "js", &Uint8Array::from(out.js.as_slice()).into())?;
	set_obj(
		&obj,
		"map",
		&Uint8Array::from(out.sourcemap.as_slice()).into(),
	)?;
	set_obj(&obj, "scramtag", &sourcetag.into())?;
	#[cfg(feature = "debug")]
	set_obj(&obj, "errors", &errs.into())?;
	#[cfg(not(feature = "debug"))]
	set_obj(&obj, "errors", &js_sys::Array::new())?;
	set_obj(&obj, "duration", &duration_to_millis_f64(duration).into())?;

	Ok(JsRewriterOutput::from(JsValue::from(obj)))
}

#[wasm_bindgen]
pub fn rewrite_js(
	js: std::string::String,
	url: &str,
	script_url: std::string::String,
	module: bool,
	scramjet: &Object,
) -> Result<JsRewriterOutput> {
	ALLOC.with(|x| {
		let mut alloc = x.try_borrow_mut()?;

		let cfg = get_config(scramjet, url, &alloc)?;
		let sourcetag = cfg.sourcetag;

		let before = Instant::now();
		let out = rewrite(&alloc, &js, cfg, module, 1024)?;
		let after = Instant::now();

		let ret = create_rewriter_output(out, script_url, js, sourcetag, after - before);

		alloc.reset();
		ret
	})
}

#[wasm_bindgen]
pub fn rewrite_js_from_arraybuffer(
	js: Vec<u8>,
	url: &str,
	script_url: std::string::String,
	module: bool,
	scramjet: &Object,
) -> Result<JsRewriterOutput> {
	// we know the js is a valid utf-8 string
	let js = unsafe { std::string::String::from_utf8_unchecked(js) };

	rewrite_js(js, url, script_url, module, scramjet)
}

use std::{collections::HashMap, error::Error};

use html::{Rewriter, VisitorExternalTool, rule::RewriteRule};
use js_sys::{Array, Function, Object, Uint8Array};
use oxc::allocator::Allocator;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};

use crate::{
	error::{Result, RewriterError},
	get_obj, set_obj,
};

#[wasm_bindgen(typescript_custom_section)]
const REWRITER_OUTPUT: &'static str = r#"
export type HtmlRewriterOutput = { 
	html: Uint8Array,
};
"#;

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(typescript_type = "HtmlRewriterOutput")]
	pub type HtmlRewriterOutput;
}

pub type HtmlRewriter = Rewriter<(Object, Object, Function, Function, Function)>;

fn build_rules(
	rules: Vec<Object>,
) -> Result<Vec<RewriteRule<(Object, Object, Function, Function, Function)>>> {
	rules
		.into_iter()
		.map(|x| {
			let entries = Object::entries(&x)
				.to_vec()
				.into_iter()
				.map(|x| {
					let arr = x
						.dyn_into::<Array>()
						.map_err(|_| RewriterError::not_arr("Object.entries"))?
						.to_vec();

					Ok((
						arr[0]
							.as_string()
							.ok_or(RewriterError::not_str("Object.entries key"))?,
						arr[1].clone(),
					))
				})
				.collect::<Result<Vec<(String, JsValue)>>>()?;

			let mut func = None;
			let mut attrs = HashMap::new();

			for (k, v) in entries {
				if k == "fn" {
					func = Some(
						v.dyn_into::<Function>()
							.map_err(|_| RewriterError::not_fn("htmlRules fn"))?,
					);
				} else if let Ok(v) = v.clone().dyn_into::<Array>() {
					let els = v
						.to_vec()
						.into_iter()
						.map(|x| {
							x.as_string()
								.ok_or(RewriterError::not_str("htmlRules value array value"))
						})
						.collect::<Result<_>>()?;

					attrs.insert(k, Some(els));
				} else {
					let el = v
						.as_string()
						.ok_or(RewriterError::not_str("htmlRules value"))?;

					if el == "*" {
						attrs.insert(k, None);
					}
				}
			}

			Ok(RewriteRule {
				attrs,
				func: Box::new(
					move |alloc,
					      val,
					      (meta, cookie, _, _, _): &(
						Object,
						Object,
						Function,
						Function,
						Function,
					)| {
						func.as_ref()
							.map(|x| {
								let ret = x
									.call3(&JsValue::NULL, &val.into(), meta, cookie)
									.map_err(RewriterError::from)
									.map_err(Box::new)?;

								Ok(ret.as_string().map(|x| alloc.alloc_str(&x)))
							})
							.transpose()
							.map(Option::flatten)
					},
				),
			})
		})
		.collect::<Result<_>>()
}

#[wasm_bindgen(inline_js = r#"
export function setMeta(meta, val) {
	meta.base = new URL(val, meta.origin);
}
export function base64(bytes) {
	const binString = Array.from(bytes, (byte) =>
		String.fromCodePoint(byte)
	).join("");

	return btoa(binString);
}
export function rewriteJsAttr(fn, attr, code, meta) {
	return fn(code, `(inline ${attr} on element)`, meta);
}
export function rewriteJsInline(fn, code, module, meta) {
	return fn(code, `(inline script element)`, meta, module);
}
export function rewriteCss(fn, code, meta) {
	return fn(code, meta);
}
export function rewriteHttpEquiv(fn, content, meta) {
	const contentArray = content.split("url=");
	if (contentArray[1])
		contentArray[1] = fn(contentArray[1].trim(), meta);
	return contentArray.join("url=");
}
export function log(val) { console.log("aaaaa", val) }
"#)]
extern "C" {
	#[wasm_bindgen(js_name = "setMeta")]
	fn __external_tool_set_meta(meta: &Object, val: &str);
	#[wasm_bindgen(js_name = "base64")]
	fn __external_tool_base64(bytes: Uint8Array) -> String;
	#[wasm_bindgen(js_name = "rewriteJsAttr")]
	fn __external_tool_rewrite_js_attr(
		func: &Function,
		attr: &str,
		code: &str,
		meta: &Object,
	) -> String;
	#[wasm_bindgen(js_name = "rewriteJsInline")]
	fn __external_tool_rewrite_js_inline(
		func: &Function,
		code: &str,
		module: bool,
		meta: &Object,
	) -> String;
	#[wasm_bindgen(js_name = "rewriteCss")]
	fn __external_tool_rewrite_css(func: &Function, code: &str, meta: &Object) -> String;
	#[wasm_bindgen(js_name = "rewriteHttpEquiv")]
	fn __external_tool_rewrite_http_equiv(func: &Function, content: &str, meta: &Object) -> String;
	#[wasm_bindgen(js_name = "log")]
	fn __external_tool_log(val: &str);
}

fn external_tool<'alloc, 'data>(
	alloc: &'alloc Allocator,
	tool: VisitorExternalTool<'data>,
	(meta, _, rewrite_js, rewrite_css, rewrite_url): &'data (
		Object,
		Object,
		Function,
		Function,
		Function,
	),
) -> std::result::Result<Option<&'alloc str>, Box<dyn Error + Sync + Send>> {
	match tool {
		VisitorExternalTool::SetMetaBase(val) => {
			__external_tool_set_meta(meta, val);
			Ok(None)
		}
		VisitorExternalTool::Base64(val) => Ok(Some(
			alloc.alloc_str(&__external_tool_base64(Uint8Array::from(val.as_bytes()))),
		)),
		VisitorExternalTool::RewriteJsAttr { attr, code } => Ok(Some(alloc.alloc_str(
			&__external_tool_rewrite_js_attr(rewrite_js, attr, code, meta),
		))),
		VisitorExternalTool::RewriteInlineScript { code, module } => Ok(Some(alloc.alloc_str(
			&__external_tool_rewrite_js_inline(rewrite_js, code, module, meta),
		))),
		VisitorExternalTool::RewriteCss(css) => Ok(Some(
			alloc.alloc_str(&__external_tool_rewrite_css(rewrite_css, css, meta)),
		)),
		VisitorExternalTool::RewriteHttpEquivContent(content) => Ok(Some(alloc.alloc_str(
			&__external_tool_rewrite_http_equiv(rewrite_url, content, meta),
		))),
		VisitorExternalTool::Log(log) => {
			__external_tool_log(log);
			Ok(None)
		}
	}
}

pub fn create_html(scramjet: &Object) -> Result<HtmlRewriter> {
	let shared = get_obj(scramjet, "shared")?;
	let rewrite = get_obj(&shared, "rewrite")?;
	let html_rules = get_obj(&rewrite, "htmlRules")?
		.dyn_into::<Array>()
		.map_err(|_| RewriterError::not_arr("htmlRules"))?;
	let html_rules = html_rules.to_vec().into_iter().map(Object::from).collect();

	let rules = build_rules(html_rules)?;

	Ok(HtmlRewriter::new(rules, Box::new(external_tool))?)
}

pub fn get_html_params(scramjet: &Object) -> Result<(Function, Function, Function)> {
	let shared = get_obj(scramjet, "shared")?;
	let rewrite = get_obj(&shared, "rewrite")?;

	let js = get_obj(&rewrite, "rewriteJs")?
		.dyn_into::<Function>()
		.map_err(|_| RewriterError::not_fn("rewriteJs"))?;
	let css = get_obj(&rewrite, "rewriteCss")?
		.dyn_into::<Function>()
		.map_err(|_| RewriterError::not_fn("rewriteCss"))?;
	let url = get_obj(&rewrite, "rewriteUrl")?
		.dyn_into::<Function>()
		.map_err(|_| RewriterError::not_fn("rewriteUrl"))?;

	Ok((js, css, url))
}

pub fn create_html_output(out: &[u8]) -> Result<HtmlRewriterOutput> {
	let obj = Object::new();
	set_obj(&obj, "html", &Uint8Array::from(out).into())?;

	Ok(HtmlRewriterOutput::from(JsValue::from(obj)))
}

use std::collections::HashMap;

use html::{Rewriter, rule::RewriteRule};
use js_sys::{Array, Function, Object, Uint8Array};
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

pub type HtmlRewriter = Rewriter<(Object, Object)>;

fn build_rules(rules: Vec<Object>) -> Result<Vec<RewriteRule<(Object, Object)>>> {
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
				func: Box::new(move |alloc, val, (meta, cookie): &(Object, Object)| {
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
				}),
			})
		})
		.collect::<Result<_>>()
}

pub fn create_html(scramjet: &Object) -> Result<HtmlRewriter> {
	let shared = get_obj(scramjet, "shared")?;
	let rewrite = get_obj(&shared, "rewrite")?;
	let html_rules = get_obj(&rewrite, "htmlRules")?
		.dyn_into::<Array>()
		.map_err(|_| RewriterError::not_arr("htmlRules"))?;
	let html_rules = html_rules.to_vec().into_iter().map(Object::from).collect();

	let rules = build_rules(html_rules)?;

	Ok(HtmlRewriter::new(rules)?)
}

pub fn create_html_output(out: oxc::allocator::Vec<'_, u8>) -> Result<HtmlRewriterOutput> {
	let obj = Object::new();
	set_obj(&obj, "js", &Uint8Array::from(out.as_slice()).into())?;

	Ok(HtmlRewriterOutput::from(JsValue::from(obj)))
}

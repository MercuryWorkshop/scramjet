use std::{env, fs, str::FromStr, sync::Arc};

use anyhow::{Context, Result};
use oxc::diagnostics::NamedSource;
use rewriter::{cfg::Config, rewrite, RewriteResult};
use url::Url;
use urlencoding::encode;

fn encode_string(str: String) -> String {
	encode(&str).to_string()
}

fn dorewrite(data: &str) -> Result<RewriteResult> {
	rewrite(
		data,
		Config {
			prefix: "/scrammedjet/".to_string(),
			encoder: Box::new(encode_string),

			base: Url::from_str("https://google.com/glorngle/si.js").context("invalid base")?,
			sourcetag: "glongle1".to_string(),

			wrapfn: "$wrap".to_string(),
			wrapthisfn: "$gwrap".to_string(),
			importfn: "$import".to_string(),
			rewritefn: "$rewrite".to_string(),
			metafn: "$meta".to_string(),
			setrealmfn: "$setrealm".to_string(),
			pushsourcemapfn: "$pushsourcemap".to_string(),

			capture_errors: true,
			do_sourcemaps: true,
			scramitize: false,
			strict_rewrites: true,
		},
	)
	.context("failed to rewrite file")
}

fn dobench(data: String) {
	loop {
		let _ = dorewrite(&data);
	}
}

fn main() -> Result<()> {
	let file = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
	let data = fs::read_to_string(file).context("failed to read file")?;
	let bench = env::args().nth(2).is_some();

	if bench {
		for _ in 0..15 {
			let data = data.clone();
			std::thread::spawn(move || dobench(data));
		}
		dobench(data);
	} else {
		let res = dorewrite(&data)?;

		let source = Arc::new(
			NamedSource::new(data, "https://google.com/glorngle/si.js").with_language("javascript"),
		);
		eprintln!("errors:");
		for err in res.errors {
			eprintln!("{}", err.with_source_code(source.clone()));
		}

		println!(
			"rewritten:\n{}",
			String::from_utf8(res.js).context("failed to parse rewritten js")?
		);
	}

	Ok(())
}

#[cfg(test)]
mod test {
	use std::fs;

	use boa_engine::{
		js_str, js_string,
		object::ObjectInitializer,
		property::{Attribute, PropertyDescriptorBuilder},
		Context, NativeFunction, Source,
	};

	use crate::dorewrite;

	#[test]
	fn google() {
		let source_text = include_str!("../sample/google.js");
		dorewrite(source_text).unwrap();
	}

	#[test]
	fn test() {
		let files = fs::read_dir("./tests").unwrap();

		for file in files {
			if !file
				.as_ref()
				.unwrap()
				.file_name()
				.to_str()
				.unwrap()
				.ends_with(".js")
			{
				continue;
			}

			let content = fs::read_to_string(file.unwrap().path()).unwrap();

			let mut context = Context::default();

			let window = ObjectInitializer::new(&mut context).build();
			context
				.register_global_property(js_str!("window"), window, Attribute::READONLY)
				.unwrap();
			context
				.global_object()
				.define_property_or_throw(
					js_str!("location"),
					PropertyDescriptorBuilder::new()
						.get(
							NativeFunction::from_copy_closure(|_, _, _| {
								Ok(js_str!("location").into())
							})
							.to_js_function(context.realm()),
						)
						.set(
							NativeFunction::from_copy_closure(|_, _, _| {
								panic!("fail: window.location got set")
							})
							.to_js_function(context.realm()),
						)
						.build(),
					&mut context,
				)
				.unwrap();

			context
				.register_global_callable(
					js_string!("fail"),
					0,
					NativeFunction::from_copy_closure(|_, _, _| {
						panic!("fail");
					}),
				)
				.unwrap();

			let result = context
				.eval(Source::from_bytes(
					br#"
function $wrap(val) {
	if (val === window || val === "location" || val === globalThis) return "";

    return val;
}

const $gwrap = $wrap;

function $scramitize(val) { return val }

function assert(val) {
	if (!val) fail();
}

function check(val) {
    if (val === window || val === "location") fail();
}
			    "#,
				))
				.unwrap();

			let rewritten = dorewrite(&content).unwrap();
			println!("{}", std::str::from_utf8(&rewritten.js).unwrap());

			context.eval(Source::from_bytes(&rewritten.js)).unwrap();
			println!("PASS");
		}
	}
}

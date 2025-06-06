#[cfg(test)]
mod test {
	use std::fs;

	use crate::rewriter::NativeRewriter;
	use boa_engine::{
		Context, NativeFunction, Source, js_str, js_string,
		object::ObjectInitializer,
		property::{Attribute, PropertyDescriptorBuilder},
	};

	fn create_context() -> Context {
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
						NativeFunction::from_copy_closure(|_, _, _| Ok(js_str!("location").into()))
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

		context
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

		context
	}

	#[test]
	fn google() {
		let source_text = include_str!("../sample/google.js");

		let rewriter = NativeRewriter::default();
		rewriter.rewrite_default(source_text).unwrap();
	}

	#[test]
	fn rewrite_tests() {
		let files = fs::read_dir("./tests").unwrap();

		let mut rewriter = NativeRewriter::default();

		for file in files.map(|x| x.unwrap()) {
			if !file.path().extension().unwrap().eq_ignore_ascii_case("js") {
				continue;
			}

			let content = fs::read_to_string(file.path()).unwrap();

			let rewritten = rewriter.rewrite_default(&content).unwrap();
			println!("{}", std::str::from_utf8(&rewritten.js).unwrap());

			let mut ctx = create_context();

			ctx.eval(Source::from_bytes(rewritten.js.as_slice()))
				.unwrap();

			println!("PASS");

			rewriter.reset();
		}
	}
}

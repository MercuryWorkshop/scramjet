use std::{
env, fs,
	str::FromStr,
	sync::Arc,
	time::{Duration, Instant},
};

use anyhow::{Context, Result};
use bytes::{Buf, Bytes, BytesMut};
use js::{cfg::Config, rewrite, RewriteResult};
use oxc::{
	allocator::{Allocator, StringBuilder},
	diagnostics::NamedSource,
};
use url::Url;
use urlencoding::encode;

fn dorewrite<'alloc>(alloc: &'alloc Allocator, data: &str) -> Result<RewriteResult<'alloc>> {
	let url = Url::from_str("https://google.com/glorngle/si.js").context("failed to make url")?;
	rewrite(
		alloc,
		data,
		Config {
			prefix: "/scrammedjet/",
			base: "https://google.com/glorngle/si.js",
			urlrewriter: move |x: &str, builder: &mut StringBuilder<'alloc>| {
				builder.push_str(encode(url.join(x).unwrap().as_str()).as_ref());
			},

			sourcetag: "glongle1",

			wrapfn: "$wrap",
			wrapthisfn: "$gwrap",
			importfn: "$import",
			rewritefn: "$rewrite",
			metafn: "$meta",
			setrealmfn: "$setrealm",
			pushsourcemapfn: "$pushsourcemap",

			capture_errors: true,
			do_sourcemaps: true,
			scramitize: false,
			strict_rewrites: true,
		},
		true,
		1024,
	)
	.context("failed to rewrite file")
}

#[derive(Debug)]
enum RewriteType {
	Insert { pos: u32, size: u32 },
	Replace { start: u32, end: u32, str: Bytes },
}

fn dounrewrite(res: &RewriteResult) -> Vec<u8> {
	let js = res.js.as_slice();
	let mut map = Bytes::from(res.sourcemap.to_vec());
	let rewrite_cnt = map.get_u32_le();
	let mut rewrites = Vec::with_capacity(rewrite_cnt as usize);

	for x in 0..rewrite_cnt {
		let ty = map.get_u8();
		if ty == 0 {
			rewrites.push(RewriteType::Insert {
				pos: map.get_u32_le(),
				size: map.get_u32_le(),
			});
		} else if ty == 1 {
			let len = map.get_u32_le();
			rewrites.push(RewriteType::Replace {
				start: map.get_u32_le(),
				end: map.get_u32_le(),
				str: map.split_to(len as usize),
			});
		} else {
			panic!(
				"{x} {ty} {:X?} {:#?}",
				map.slice(0..10).as_ref(),
				&rewrites.last_chunk::<3>()
			)
		}
	}

	let mut out = BytesMut::with_capacity(res.js.len());

	let mut cursor: u32 = 0;

	for rewrite in rewrites {
		match rewrite {
			RewriteType::Insert { pos, size } => {
				out.extend_from_slice(&js[cursor as usize..pos as usize]);
				cursor = pos + size;
			}
			RewriteType::Replace { start, end, str } => {
				out.extend_from_slice(&js[cursor as usize..start as usize]);
				out.extend_from_slice(&str);
				cursor = end;
			}
		}
	}

	out.extend_from_slice(&js[cursor as usize..]);

	out.to_vec()
}

fn main() -> Result<()> {
	let file = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
	let data = fs::read_to_string(file).context("failed to read file")?;
	let bench = env::args().nth(2).map(|x| usize::from_str(&x));

	let mut alloc = Allocator::default();

	if let Some(cnt) = bench.transpose().context("invalid bench size")? {
		let mut duration = Duration::from_secs(0);

		let cnt = cnt * 100;

		for x in 1..=cnt {
			let before = Instant::now();
			let _ = dorewrite(&alloc, &data);
			let after = Instant::now();

			duration += after - before;

			alloc.reset();
			if x % 100 == 0 {
				println!("{x}...");
			}
		}

		println!("iterations: {cnt}");
		println!("total time: {duration:?}");
		println!("avg time: {:?}", duration / cnt as u32);
	} else {
		println!("orig:\n{data}");

		let res = dorewrite(&alloc, &data)?;

		let source = Arc::new(
			NamedSource::new(data.clone(), "https://google.com/glorngle/si.js")
				.with_language("javascript"),
		);
		eprintln!("errors:");
		for err in res.errors.clone() {
			eprintln!("{}", err.with_source_code(source.clone()));
		}

		println!(
			"rewritten:\n{}",
			str::from_utf8(&res.js).context("failed to parse rewritten js")?
		);

		let unrewritten = dounrewrite(&res);

		println!(
			"unrewritten matches orig: {}",
			data.as_bytes() == unrewritten.as_slice()
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
	use oxc::allocator::Allocator;

	use crate::dorewrite;

	#[test]
	fn google() {
		let alloc = Allocator::default();

		let source_text = include_str!("../sample/google.js");
		dorewrite(&alloc, source_text).unwrap();
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

			let alloc = Allocator::default();
			let rewritten = dorewrite(&alloc, &content).unwrap();
			println!("{}", std::str::from_utf8(&rewritten.js).unwrap());

			context
				.eval(Source::from_bytes(rewritten.js.as_slice()))
				.unwrap();
			println!("PASS");
		}
	}
}

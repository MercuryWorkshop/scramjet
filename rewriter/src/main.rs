#![allow(clippy::print_stdout)]
use std::{
	borrow::Cow,
	env,
	path::Path,
	str::{from_utf8, FromStr},
};

pub mod rewrite;

use rewrite::rewrite;
use url::Url;

use crate::rewrite::Config;

// Instruction:
// create a `test.js`,
// run `cargo run -p oxc_parser --example visitor`
// or `cargo watch -x "run -p oxc_parser --example visitor"`

/// Percent-encodes every byte except alphanumerics and `-`, `_`, `.`, `~`. Assumes UTF-8 encoding.
///
/// Call `.into_owned()` if you need a `String`
#[inline(always)]
#[must_use]
pub fn encode(data: &str) -> Cow<'_, str> {
	encode_binary(data.as_bytes())
}

/// Percent-encodes every byte except alphanumerics and `-`, `_`, `.`, `~`.
#[inline]
#[must_use]
pub fn encode_binary(data: &[u8]) -> Cow<'_, str> {
	// add maybe extra capacity, but try not to exceed allocator's bucket size
	let mut escaped = String::new();
	let _ = escaped.try_reserve(data.len() | 15);
	let unmodified = append_string(data, &mut escaped, true);
	if unmodified {
		return Cow::Borrowed(unsafe {
			// encode_into has checked it's ASCII
			std::str::from_utf8_unchecked(data)
		});
	}
	Cow::Owned(escaped)
}

fn append_string(data: &[u8], escaped: &mut String, may_skip: bool) -> bool {
	encode_into(data, may_skip, |s| {
		escaped.push_str(s);
		Ok::<_, std::convert::Infallible>(())
	})
	.unwrap()
}

fn encode_into<E>(
	mut data: &[u8],
	may_skip_write: bool,
	mut push_str: impl FnMut(&str) -> Result<(), E>,
) -> Result<bool, E> {
	let mut pushed = false;
	loop {
		// Fast path to skip over safe chars at the beginning of the remaining string
		let ascii_len = data
			.iter()
			.take_while(
				|&&c| matches!(c, b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' |  b'-' | b'.' | b'_' | b'~'),
			)
			.count();

		let (safe, rest) = if ascii_len >= data.len() {
			if !pushed && may_skip_write {
				return Ok(true);
			}
			(data, &[][..]) // redundatnt to optimize out a panic in split_at
		} else {
			data.split_at(ascii_len)
		};
		pushed = true;
		if !safe.is_empty() {
			push_str(unsafe { std::str::from_utf8_unchecked(safe) })?;
		}
		if rest.is_empty() {
			break;
		}

		match rest.split_first() {
			Some((byte, rest)) => {
				let enc = &[b'%', to_hex_digit(byte >> 4), to_hex_digit(byte & 15)];
				push_str(unsafe { std::str::from_utf8_unchecked(enc) })?;
				data = rest;
			}
			None => break,
		};
	}
	Ok(false)
}

#[inline]
fn to_hex_digit(digit: u8) -> u8 {
	match digit {
		0..=9 => b'0' + digit,
		10..=255 => b'A' - 10 + digit,
	}
}

fn encode_string(s: String) -> String {
	encode(&s).to_string()
}

fn dorewrite(source_text: &str) -> String {
	from_utf8(
		rewrite(
			&source_text,
			Url::from_str("https://google.com/glorngle/si.js").unwrap(),
			Config {
				prefix: "/scrammedjet/".to_string(),
				encode: Box::new(encode_string),
				wrapfn: "$wrap".to_string(),
				importfn: "$import".to_string(),
				rewritefn: "$rewrite".to_string(),
				metafn: "$meta".to_string(),
				setrealmfn: "$setrealm".to_string(),
				pushsourcemapfn: "$pushsourcemap".to_string(),
				capture_errors: true,
				do_sourcemaps: true,
				scramitize: false,
			},
		)
		.as_slice(),
	)
	.unwrap()
	.to_string()
}

fn main() -> std::io::Result<()> {
	let name = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
	let path = Path::new(&name);
	let source_text = std::fs::read_to_string(path)?;

	println!("{}", dorewrite(&source_text));

	Ok(())
}

#[cfg(test)]
mod tests {
	use std::{fs, path::Path};

	use boa_engine::{
		js_str, js_string,
		object::ObjectInitializer,
		property::{Attribute, PropertyDescriptorBuilder},
		Context, NativeFunction, Source,
	};

	use crate::dorewrite;

	#[test]
	fn google() {
		// sanity check- just making sure it won't crash
		let source_text = include_str!("../sample/google.js");
		dorewrite(source_text);
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

function assert(val) {
	if (!val) fail();
}

function check(val) {
    if (val === window || val === "location") fail();
}
			    "#,
				))
				.unwrap();

			let rewritten = dorewrite(&content);
			println!("{}", rewritten);

			context
				.eval(Source::from_bytes(rewritten.as_bytes()))
				.unwrap();
			println!("PASS");
		}
	}
}

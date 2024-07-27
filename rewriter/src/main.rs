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
        let ascii_len = data.iter()
            .take_while(|&&c| matches!(c, b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' |  b'-' | b'.' | b'_' | b'~')).count();

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

fn main() -> std::io::Result<()> {
    let name = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
    let path = Path::new(&name);
    let source_text = std::fs::read_to_string(path)?;

    println!(
        "{}",
        from_utf8(
            rewrite(
                &source_text,
                Url::from_str("https://google.com/glorngle/si.js").unwrap(),
                "/scrammedjet/".to_string(),
                Box::new(encode_string),
                "$wrap".to_string(),
                "$import".to_string(),
            )
            .as_slice()
        )
        .unwrap()
    );

    Ok(())
}

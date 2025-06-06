use std::str::FromStr;

use anyhow::{Context, Result};
use bytes::Buf;
use js::{
	RewriteResult, Rewriter,
	cfg::{Config, Flags, UrlRewriter},
};
use oxc::allocator::{Allocator, StringBuilder};
use url::Url;
use urlencoding::encode;

struct NativeUrlRewriter(Url);

impl NativeUrlRewriter {
	pub fn new() -> Result<Self> {
		Ok(Self(
			Url::from_str("https://google.com/glorngle/si.js").context("failed to make url")?,
		))
	}
}

impl UrlRewriter for NativeUrlRewriter {
	fn rewrite(&self, _cfg: &Config, _flags: &Flags, url: &str, builder: &mut StringBuilder) {
		builder.push_str(encode(self.0.join(url).unwrap().as_str()).as_ref());
	}
}

#[derive(Debug)]
enum RewriteType<'a> {
	Insert { pos: u32, size: u32 },
	Replace { start: u32, end: u32, str: &'a [u8] },
}

pub struct NativeRewriter {
	alloc: Allocator,
	rewriter: Rewriter<NativeUrlRewriter>,
}

impl NativeRewriter {
	pub fn new() -> Result<Self> {
		let rewriter = Rewriter::new(
			Config {
				prefix: "/scrammedjet/".to_string(),
				wrapfn: "$wrap".to_string(),
				wrapthisfn: "$gwrap".to_string(),
				importfn: "$import".to_string(),
				rewritefn: "$rewrite".to_string(),
				metafn: "$meta".to_string(),
				setrealmfn: "$setrealm".to_string(),
				pushsourcemapfn: "$pushsourcemap".to_string(),
			},
			NativeUrlRewriter::new()?,
		);

		Ok(Self {
			alloc: Allocator::new(),
			rewriter,
		})
	}

	pub fn rewrite(&self, data: &str) -> Result<RewriteResult<'_>> {
		self.rewriter
			.rewrite(
				&self.alloc,
				data,
				Flags {
					base: "https://google.com/glorngle/si.js".to_string(),
					sourcetag: "glongle1".to_string(),

					is_module: true,

					capture_errors: true,
					do_sourcemaps: true,
					scramitize: false,
					strict_rewrites: true,
				},
			)
			.context("failed to rewrite file")
	}
	pub fn reset(&mut self) {
		self.alloc.reset();
	}

	pub fn unrewrite(res: &RewriteResult) -> Vec<u8> {
		let js = res.js.as_slice();
		let mut map = res.sourcemap.as_slice();
		let rewrite_cnt = map.get_u32_le();
		let mut rewrites = Vec::with_capacity(rewrite_cnt as usize);

		for x in 0..rewrite_cnt {
			let pos = map.get_u32_le();
			let size = map.get_u32_le();

			let ty = map.get_u8();
			if ty == 0 {
				rewrites.push(RewriteType::Insert { pos, size });
			} else if ty == 1 {
				let len = map.get_u32_le();

				let (str, new) = map.split_at(len as usize);
				map = new;

				rewrites.push(RewriteType::Replace {
					start: pos,
					end: pos + size,
					str,
				});
			} else {
				panic!(
					"{x} {ty} {:X?} {:#?}",
					&map[0..10],
					&rewrites.last_chunk::<3>()
				)
			}
		}

		let mut out = Vec::with_capacity(res.js.len());

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
}

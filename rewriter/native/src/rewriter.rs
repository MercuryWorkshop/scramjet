use std::{error::Error, str::FromStr};

use anyhow::{Context, Result};
use bytes::Buf;
use js::{
	RewriteResult, Rewriter,
	cfg::{Config, Flags, UrlRewriter},
};
use oxc::allocator::{Allocator, StringBuilder};
use url::Url;
use urlencoding::encode;

use crate::RewriterOptions;

struct NativeUrlRewriter;

impl UrlRewriter for NativeUrlRewriter {
	fn rewrite(
		&self,
		_cfg: &Config,
		flags: &Flags,
		url: &str,
		builder: &mut StringBuilder,
	) -> Result<(), Box<dyn Error + Sync + Send>> {
		let base = Url::from_str(&flags.base)?;
		builder.push_str(encode(base.join(url)?.as_str()).as_ref());

		Ok(())
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
	#[allow(dead_code)]
	pub fn default() -> Self {
		Self::new(&RewriterOptions::default())
	}

	pub fn new(cfg: &RewriterOptions) -> Self {
		let rewriter = Rewriter::new(
			Config {
				prefix: cfg.prefix.clone(),
				wrapfn: cfg.wrapfn.clone(),
				wrapthisfn: cfg.wrapthisfn.clone(),
				importfn: cfg.importfn.clone(),
				rewritefn: cfg.rewritefn.clone(),
				metafn: cfg.metafn.clone(),
				setrealmfn: cfg.setrealmfn.clone(),
				pushsourcemapfn: cfg.pushsourcemapfn.clone(),
			},
			NativeUrlRewriter,
		);

		Self {
			alloc: Allocator::new(),
			rewriter,
		}
	}

	#[allow(dead_code)]
	pub fn rewrite_default(&self, data: &str) -> Result<RewriteResult<'_>> {
		self.rewrite(data, &RewriterOptions::default())
	}

	pub fn rewrite(&self, data: &str, cfg: &RewriterOptions) -> Result<RewriteResult<'_>> {
		self.rewriter
			.rewrite(
				&self.alloc,
				data,
				Flags {
					base: cfg.base.clone(),
					sourcetag: cfg.sourcetag.clone(),

					is_module: cfg.is_module,

					capture_errors: cfg.capture_errors,
					do_sourcemaps: cfg.do_sourcemaps,
					scramitize: cfg.scramitize,
					strict_rewrites: cfg.strict_rewrites,
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

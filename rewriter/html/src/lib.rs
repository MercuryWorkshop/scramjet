use std::borrow::Cow;

use lol_html::{ElementContentHandlers, HtmlRewriter, OutputSink, Settings};
use oxc::allocator::{Allocator, Vec};
use rule::{LolHtmlRewriteRule, RewriteRule};
use thiserror::Error;

pub mod rule;

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("lol html fail: {0}")]
	LolHtml(#[from] lol_html::errors::RewritingError),
	#[error("selector failed to parse: {0}")]
	Selector(#[from] lol_html::errors::SelectorError),
	#[error("attribute name invalid: {0}")]
	AttributeName(#[from] lol_html::errors::AttributeNameError),

	#[error("failed to get attribute in rewrite rule")]
	RewriteAttributeGone,
}

struct OxcOutputSink<'alloc, 'r>(&'r mut Vec<'alloc, u8>);

impl OutputSink for OxcOutputSink<'_, '_> {
	fn handle_chunk(&mut self, chunk: &[u8]) {
		self.0.extend_from_slice_copy(chunk);
	}
}

pub struct Rewriter {
	rules: std::vec::Vec<LolHtmlRewriteRule>,
}

impl Rewriter {
	pub fn new<'alloc>(
		alloc: &'alloc Allocator,
		rules: Vec<'alloc, RewriteRule<'alloc>>,
	) -> Result<Self, RewriterError> {
		Ok(Self {
			rules: rules
				.into_iter()
				.flat_map(|x| x.into_lol_html(alloc))
				.collect::<Result<_, _>>()?,
		})
	}

	pub fn rewrite<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
		html: &'data str,
	) -> Result<Vec<'alloc, u8>, RewriterError> {
		let settings = Settings {
			element_content_handlers: self
				.rules
				.iter()
				.map(|(selector, func)| {
					(
						Cow::Borrowed(selector),
						ElementContentHandlers {
							element: Some(func.create()),
							comments: None,
							text: None,
						},
					)
				})
				.collect(),
			..Settings::new()
		};

		let mut vec = Vec::with_capacity_in(html.len(), alloc);

		let mut rewriter = HtmlRewriter::new(settings, OxcOutputSink(&mut vec));
		rewriter.write(html.as_bytes())?;
		rewriter.end()?;

		Ok(vec)
	}
}

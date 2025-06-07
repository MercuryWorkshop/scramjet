use std::num::TryFromIntError;

use oxc::allocator::Allocator;
use rule::RewriteRule;
use thiserror::Error;
use tl::ParserOptions;
use visitor::Visitor;

pub mod rule;
mod visitor;

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("tl: {0}")]
	Tl(#[from] tl::ParseError),

	#[error("Not utf8")]
	NotUtf8,
	#[error("usize too big")]
	ConversionFailed(#[from] TryFromIntError),
}

pub struct Rewriter {
	rules: Vec<RewriteRule>,
}

impl Rewriter {
	pub fn new(rules: Vec<RewriteRule>) -> Result<Self, RewriterError> {
		Ok(Self { rules })
	}

	pub fn rewrite<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
		html: &'data str,
	) -> Result<(), RewriterError> {
		let tree = tl::parse(html, ParserOptions::default())?;

		let visitor = Visitor::new(html, &self.rules, tree);
		visitor.visit()?;

		Ok(())
	}
}

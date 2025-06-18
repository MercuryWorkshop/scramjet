use std::{cell::RefCell, error::Error, num::TryFromIntError};

use changes::HtmlChanges;
use oxc::allocator::Allocator;
use rule::RewriteRule;
use thiserror::Error;
use tl::ParserOptions;
use visitor::Visitor;

mod changes;
pub mod rule;
mod visitor;

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("tl: {0}")]
	Tl(#[from] tl::ParseError),
	#[error("transformer: {0}")]
	Transformer(#[from] transform::TransformError),

	#[error("rewrite function: {0}")]
	Rewrite(Box<dyn Error + Sync + Send>),

	#[error("Not utf8")]
	NotUtf8,
	#[error("usize too big")]
	ConversionFailed(#[from] TryFromIntError),
	#[error("Already rewriting")]
	AlreadyRewriting,
	#[error("Not rewriting")]
	NotRewriting,
	#[error("Changes left over")]
	Leftover,
}

pub struct Rewriter<T> {
	rules: Vec<RewriteRule<T>>,

	changes: RefCell<Option<HtmlChanges<'static, 'static>>>,
}

impl<T> Rewriter<T> {
	pub fn new(rules: Vec<RewriteRule<T>>) -> Result<Self, RewriterError> {
		Ok(Self {
			rules,
			changes: RefCell::new(Some(HtmlChanges::new())),
		})
	}

	fn take_changes<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
	) -> Result<HtmlChanges<'alloc, 'data>, RewriterError> {
		let mut slot = self
			.changes
			.try_borrow_mut()
			.map_err(|_| RewriterError::AlreadyRewriting)?;

		slot.take()
			.ok_or(RewriterError::AlreadyRewriting)
			.and_then(|x| {
				let mut x = unsafe {
					std::mem::transmute::<HtmlChanges<'static, 'static>, HtmlChanges<'alloc, 'data>>(
						x,
					)
				};
				x.set_alloc(alloc)?;
				Ok(x)
			})
	}

	fn put_changes<'alloc: 'data, 'data>(
		&'data self,
		mut changes: HtmlChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		if !changes.empty() {
			return Err(RewriterError::Leftover);
		}

		let mut slot = self
			.changes
			.try_borrow_mut()
			.map_err(|_| RewriterError::AlreadyRewriting)?;

		if slot.is_some() {
			Err(RewriterError::NotRewriting)
		} else {
			changes.take_alloc()?;

			let changes = unsafe {
				std::mem::transmute::<HtmlChanges<'alloc, 'data>, HtmlChanges<'static, 'static>>(
					changes,
				)
			};

			slot.replace(changes);

			Ok(())
		}
	}

	pub fn rewrite<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
		html: &'data str,
		data: &T
	) -> Result<oxc::allocator::Vec<'alloc, u8>, RewriterError> {
		let tree = tl::parse(html, ParserOptions::default())?;

		let mut changes = self.take_changes(alloc)?;

		let visitor = Visitor {
			alloc,
			rules: &self.rules,
			rule_data: data,

			data: html,
			tree,
		};
		visitor.visit(&mut changes)?;

		let res = changes.perform(html)?;

		self.put_changes(changes)?;

		Ok(res.source)
	}
}

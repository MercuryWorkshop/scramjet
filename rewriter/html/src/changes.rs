use std::marker::PhantomData;

use oxc::{allocator::Allocator, span::Span};
use transform::{
	TransformResult, Transformer,
	transform::{Transform, TransformLL},
	transforms,
};

use crate::RewriterError;

#[derive(PartialEq, Eq)]
enum HtmlRewriteType<'alloc> {
	ReplaceAttr { new: &'alloc str },
	RemoveAttr,
}

#[derive(PartialEq, Eq)]
pub struct HtmlRewrite<'alloc: 'data, 'data> {
	phantom: PhantomData<&'data str>,
	span: Span,
	ty: HtmlRewriteType<'alloc>,
}

impl<'alloc: 'data, 'data> HtmlRewrite<'alloc, 'data> {
	pub fn replace_attr(val: Span, new: &'alloc str) -> Self {
		Self {
			phantom: PhantomData,
			span: val,
			ty: HtmlRewriteType::ReplaceAttr { new },
		}
	}

	pub fn remove_attr(data: &'data str, key: Span, value: Span) -> Self {
		let end = if Self::attr_is_quoted(data, value) {
			value.end + 1
		} else {
			value.end
		};

		Self {
			phantom: PhantomData,
			span: Span::new(key.start, end),
			ty: HtmlRewriteType::RemoveAttr,
		}
	}

	fn attr_is_quoted(data: &str, attr: Span) -> bool {
		data.get((attr.start - 1) as usize..attr.start as usize)
			.is_some_and(|x| x == "\'" || x == "\"")
	}
}

impl<'alloc: 'data, 'data> Transform<'data> for HtmlRewrite<'alloc, 'data> {
	type ToLowLevelData = &'data str;

	fn span(&self) -> Span {
		self.span
	}

	fn into_low_level(self, data: &Self::ToLowLevelData, _cursor: u32) -> TransformLL<'data> {
		let data = *data;
		match self.ty {
			HtmlRewriteType::ReplaceAttr { new } => {
				TransformLL::replace(if Self::attr_is_quoted(data, self.span) {
					transforms![new]
				} else {
					transforms!["\"", new, "\""]
				})
			}
			HtmlRewriteType::RemoveAttr => TransformLL::replace(transforms![]),
		}
	}
}

impl PartialOrd for HtmlRewrite<'_, '_> {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for HtmlRewrite<'_, '_> {
	fn cmp(&self, other: &Self) -> std::cmp::Ordering {
		self.span.start.cmp(&other.span.start)
	}
}

pub(crate) struct HtmlChanges<'alloc: 'data, 'data> {
	inner: Transformer<'alloc, 'data, HtmlRewrite<'alloc, 'data>>,
}

impl<'alloc: 'data, 'data> HtmlChanges<'alloc, 'data> {
	#[inline]
	pub fn new() -> Self {
		Self {
			inner: Transformer::new(),
		}
	}

	#[inline]
	pub fn add(&mut self, rewrite: HtmlRewrite<'alloc, 'data>) {
		self.inner.add(std::iter::once(rewrite));
	}

	#[inline]
	pub fn set_alloc(&mut self, alloc: &'alloc Allocator) -> Result<(), RewriterError> {
		Ok(self.inner.set_alloc(alloc)?)
	}

	#[inline]
	pub fn take_alloc(&mut self) -> Result<(), RewriterError> {
		Ok(self.inner.take_alloc()?)
	}

	#[inline]
	pub fn empty(&self) -> bool {
		self.inner.empty()
	}

	#[inline]
	pub fn perform(&mut self, html: &'data str) -> Result<TransformResult<'alloc>, RewriterError> {
		Ok(self.inner.perform(html, &html, false)?)
	}
}

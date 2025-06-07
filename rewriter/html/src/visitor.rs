use oxc::{allocator::Allocator, span::Span};
use tl::{Bytes, Node, VDom};

use crate::{
	HtmlChanges, RewriterError,
	changes::HtmlRewrite,
	rule::{RewriteRule, RewriteRuleCallback},
};

pub struct Visitor<'alloc, 'data, T> {
	pub alloc: &'alloc Allocator,
	pub rules: &'data [RewriteRule<T>],
	pub rule_data: &'data T,

	pub data: &'data str,
	pub tree: VDom<'data>,
}

impl<'alloc, 'data, T> Visitor<'alloc, 'data, T> {
	fn calculate_bounds(&self, raw: &Bytes<'data>) -> Result<Span, RewriterError> {
		let input = self.data.as_ptr();
		let start = raw.as_ptr();
		let offset = start as usize - input as usize;
		let end = offset + raw.as_bytes().len();

		Ok(Span::new(offset.try_into()?, end.try_into()?))
	}

	fn check_rules(&self, name: &str, attr: &str) -> Option<&RewriteRuleCallback<T>> {
		self.rules
			.iter()
			.find(|x| {
				x.attrs
					.get(attr)
					.is_some_and(|x| x.as_ref().is_none_or(|x| x.contains(name)))
			})
			.map(|x| &x.func)
	}

	fn visit_node(
		&self,
		node: &Node<'data>,
		changes: &mut HtmlChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		match node {
			Node::Tag(tag) => {
				for (k, v) in tag.attributes().unstable_raw().iter() {
					let name = tag.name().try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
					let attr = k.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;

					if let Some(cb) = self.check_rules(name, attr)
						&& let Some(v) = v
					{
						let value = v.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
						let change = (cb)(self.alloc, value, self.rule_data)
							.map_err(RewriterError::Rewrite)?;

						let val = self.calculate_bounds(v)?;

						if let Some(change) = change {
							changes.add(HtmlRewrite::replace_attr(val, change));
						} else {
							let key = self.calculate_bounds(k)?;
							changes.add(HtmlRewrite::remove_attr(self.data, key, val));
						}
					}
				}
				Ok(())
			}
			_ => Ok(()),
		}
	}

	pub fn visit(&self, changes: &mut HtmlChanges<'alloc, 'data>) -> Result<(), RewriterError> {
		for node in self.tree.nodes() {
			self.visit_node(node, changes)?;
		}
		Ok(())
	}
}

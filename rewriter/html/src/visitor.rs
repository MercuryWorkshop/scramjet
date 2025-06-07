use std::ops::Range;

use tl::{Bytes, Node, NodeHandle, VDom};

use crate::{
	RewriterError,
	rule::{RewriteRule, RewriteRuleCallback},
};

pub struct Visitor<'data> {
	data: &'data str,
	rules: &'data [RewriteRule],
	vdom: VDom<'data>,
}

impl<'data> Visitor<'data> {
	pub fn new(data: &'data str, rules: &'data [RewriteRule], vdom: VDom<'data>) -> Self {
		Self { data, rules, vdom }
	}

	fn calculate_bounds(&self, raw: &Bytes<'data>) -> Result<Range<u32>, RewriterError> {
		let input = self.data.as_ptr();
		let start = raw.as_ptr();
		let offset = start as usize - input as usize;
		let end = offset + raw.as_bytes().len();

		Ok(offset.try_into()?..end.try_into()?)
	}

	fn check_rules(&self, name: &str, attr: &str) -> Option<&RewriteRuleCallback> {
		self.rules
			.iter()
			.find(|x| x.attrs.get(attr).is_some_and(|x| x.contains(name)))
			.map(|x| &x.func)
	}

	fn visit_node(&self, node: &Node<'data>) -> Result<(), RewriterError> {
		match node {
			Node::Tag(tag) => {
				for (k, v) in tag.attributes().unstable_raw().iter() {
					let name = tag.name().try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
					let attr = k.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;

					if let Some(cb) = self.check_rules(name, attr)
						&& let Some(v) = v
					{
						let value = v.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
						let change = (cb)(value);
						if let Some(change) = change {
							println!("need to change {:?} {:?}", change, self.calculate_bounds(v));
							// TODO
						}
					}
				}
				Ok(())
			}
			_ => Ok(()),
		}
	}

	pub fn visit(&self) -> Result<(), RewriterError> {
		for node in self.vdom.nodes() {
			self.visit_node(node)?;
		}
		Ok(())
	}
}

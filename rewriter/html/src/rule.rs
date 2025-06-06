use std::sync::Arc;

use lol_html::{HandlerTypes, LocalHandlerTypes, Selector};
use oxc::allocator::{Allocator, HashMap, StringBuilder, Vec};

use crate::RewriterError;

pub type RewriteRuleCallback = Arc<dyn Fn(&str) -> Option<String>>;

pub struct RewriteRule<'alloc> {
	pub attrs: HashMap<'alloc, &'alloc str, Vec<'alloc, &'alloc str>>,
	pub func: RewriteRuleCallback,
}

#[macro_export]
macro_rules! attrmap {
    ($alloc:ident, {
		$($attr:literal: [$($el:literal),*]),*
	}) => {
		{
			let mut map = oxc::allocator::HashMap::<'_, &'_ str, oxc::allocator::Vec<'_, &'_ str>>::new_in(&$alloc);
			$(
				{
					let mut vec = oxc::allocator::Vec::new_in(&$alloc);
					$(
						vec.push($el);
					)*
					map.insert($attr, vec);
				}
			)*
			map
		}
    };
}

pub struct LolHtmlElementHandler {
	attr: String,
	func: RewriteRuleCallback,
}
impl LolHtmlElementHandler {
	pub fn create(&self) -> <LocalHandlerTypes as HandlerTypes>::ElementHandler<'static> {
		let attr = self.attr.clone();
		let func = self.func.clone();
		Box::new(move |el| {
			let value = el
				.get_attribute(&attr)
				.ok_or(RewriterError::RewriteAttributeGone)?;

			if let Some(replacement) = (func)(&value) {
				el.set_attribute(&attr, &replacement)?;
			}

			Ok(())
		})
	}
}

pub type LolHtmlRewriteRule = (Selector, LolHtmlElementHandler);

impl<'alloc> RewriteRule<'alloc> {
	pub fn into_lol_html(
		self,
		alloc: &'alloc Allocator,
	) -> impl Iterator<Item = Result<LolHtmlRewriteRule, RewriterError>> {
		self.attrs
			.into_iter()
			.filter(|(_, els)| !els.is_empty())
			.map(move |(attr, els)| {
				let mut selector = StringBuilder::new_in(alloc);

				let len = els.len() - 1;
				for (i, el) in els.into_iter().enumerate() {
					selector.push_str(el);
					selector.push('[');
					selector.push_str(attr);
					selector.push(']');
					if i < len {
						selector.push(',');
					}
				}
				let selector = selector.into_str().parse::<Selector>()?;

				let func = self.func.clone();
				Ok((
					selector,
					LolHtmlElementHandler {
						attr: attr.to_string(),
						func,
					},
				))
			})
	}
}

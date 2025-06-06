use std::sync::Arc;

use lol_html::{HandlerTypes, LocalHandlerTypes, Selector};
use oxc::allocator::{Allocator, HashMap, StringBuilder, Vec};

use crate::RewriterError;

pub type RewriteRuleCallback = Arc<dyn Fn(&str) -> Option<String>>;

pub struct RewriteRule<'alloc> {
	pub attrs: HashMap<'alloc, String, Vec<'alloc, &'alloc str>>,
	pub func: RewriteRuleCallback,
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
			let _ = el;

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
				let len = els.len();
				for (i, el) in els.into_iter().enumerate() {
					selector.push_str(el);
					selector.push('[');
					selector.push_str(&attr);
					selector.push(']');
					if i < len - 1 {
						selector.push(',');
					}
				}
				let selector = selector.into_str().parse::<Selector>()?;

				let func = self.func.clone();
				Ok((
					selector,
					LolHtmlElementHandler {
						attr: attr.clone(),
						func,
					},
				))
			})
	}
}

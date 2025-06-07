use std::collections::{HashMap, HashSet};

use oxc::allocator::Allocator;

pub type RewriteRuleCallback =
	Box<dyn for<'alloc, 'data> Fn(&'alloc Allocator, &'data str) -> Option<&'alloc str>>;

pub struct RewriteRule {
	pub attrs: HashMap<String, HashSet<String>>,
	pub func: RewriteRuleCallback,
}

#[macro_export]
macro_rules! attrmap {
	({
		$($attr:literal: [$($el:literal),*]),*
	}) => {
		{
			let mut map = std::collections::HashMap::<String, std::collections::HashSet<String>>::new();
			$(
				{
					let mut vec = std::collections::HashSet::new();
					$(
						vec.insert($el.to_string());
					)*
					map.insert($attr.to_string(), vec);
				}
			)*
			map
		}
    };
}

use std::{
	collections::{HashMap, HashSet},
	error::Error,
};

use oxc::allocator::Allocator;

pub type RewriteRuleCallback<T> = Box<
	dyn for<'alloc, 'data> Fn(
		&'alloc Allocator,
		&'data str,
		&'data T,
	) -> Result<Option<&'alloc str>, Box<dyn Error + Sync + Send>>,
>;

pub struct RewriteRule<T> {
	pub attrs: HashMap<String, Option<HashSet<String>>>,
	pub func: RewriteRuleCallback<T>,
}

#[macro_export]
macro_rules! attrmap {
	({
		$($attr:literal: [$($el:literal),*]),*
	}) => {
		{
			let mut map = std::collections::HashMap::<String, Option<std::collections::HashSet<String>>>::new();
			$(
				{
					let mut vec = std::collections::HashSet::new();
					$(
						vec.insert($el.to_string());
					)*
					map.insert($attr.to_string(), Some(vec));
				}
			)*
			map
		}
    };
}

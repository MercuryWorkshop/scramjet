use oxc::{
	allocator::{Allocator, StringBuilder},
	span::Span,
};
use tl::{Bytes, HTMLTag, Node, VDom};

use crate::{
	HtmlChanges, RewriterError,
	changes::HtmlRewrite,
	rule::{RewriteRule, RewriteRuleCallback},
};

const EVENT_ATTRIBUTES: [&str; 100] = [
	"onbeforexrselect",
	"onabort",
	"onbeforeinput",
	"onbeforematch",
	"onbeforetoggle",
	"onblur",
	"oncancel",
	"oncanplay",
	"oncanplaythrough",
	"onchange",
	"onclick",
	"onclose",
	"oncontentvisibilityautostatechange",
	"oncontextlost",
	"oncontextmenu",
	"oncontextrestored",
	"oncuechange",
	"ondblclick",
	"ondrag",
	"ondragend",
	"ondragenter",
	"ondragleave",
	"ondragover",
	"ondragstart",
	"ondrop",
	"ondurationchange",
	"onemptied",
	"onended",
	"onerror",
	"onfocus",
	"onformdata",
	"oninput",
	"oninvalid",
	"onkeydown",
	"onkeypress",
	"onkeyup",
	"onload",
	"onloadeddata",
	"onloadedmetadata",
	"onloadstart",
	"onmousedown",
	"onmouseenter",
	"onmouseleave",
	"onmousemove",
	"onmouseout",
	"onmouseover",
	"onmouseup",
	"onmousewheel",
	"onpause",
	"onplay",
	"onplaying",
	"onprogress",
	"onratechange",
	"onreset",
	"onresize",
	"onscroll",
	"onsecuritypolicyviolation",
	"onseeked",
	"onseeking",
	"onselect",
	"onslotchange",
	"onstalled",
	"onsubmit",
	"onsuspend",
	"ontimeupdate",
	"ontoggle",
	"onvolumechange",
	"onwaiting",
	"onwebkitanimationend",
	"onwebkitanimationiteration",
	"onwebkitanimationstart",
	"onwebkittransitionend",
	"onwheel",
	"onauxclick",
	"ongotpointercapture",
	"onlostpointercapture",
	"onpointerdown",
	"onpointermove",
	"onpointerrawupdate",
	"onpointerup",
	"onpointercancel",
	"onpointerover",
	"onpointerout",
	"onpointerenter",
	"onpointerleave",
	"onselectstart",
	"onselectionchange",
	"onanimationend",
	"onanimationiteration",
	"onanimationstart",
	"ontransitionrun",
	"ontransitionstart",
	"ontransitionend",
	"ontransitioncancel",
	"oncopy",
	"oncut",
	"onpaste",
	"onscrollend",
	"onscrollsnapchange",
	"onscrollsnapchanging",
];

pub struct RewriteVisitor<'alloc, 'data, T> {
	pub alloc: &'alloc Allocator,
	pub rules: &'data [RewriteRule<T>],
	pub rule_data: &'data T,

	pub data: &'data str,
	pub tree: VDom<'data>,
}

pub struct RewriteVisitorState<'data> {
	pub base: Option<&'data str>,
}

impl<'alloc, 'data, T> RewriteVisitor<'alloc, 'data, T> {
	fn boundaries(&self, tag: &HTMLTag<'data>) -> Result<Span, RewriterError> {
		let (start, end) = tag.boundaries(self.tree.parser());
		let end = end + 1;
		Ok(Span::new(start.try_into()?, end.try_into()?))
	}

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
				x.attrs.get(attr).is_some_and(|x| {
					x.as_ref()
						.is_none_or(|x| x.contains(name) || x.contains("*"))
				})
			})
			.map(|x| &x.func)
	}

	fn visit_node(
		&self,
		state: &mut RewriteVisitorState<'data>,
		node: &'data Node<'data>,
		changes: &mut HtmlChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		match node {
			Node::Tag(tag) => {
				let name = tag.name().try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
				if name == "base"
					&& let Some(Some(val)) = tag.attributes().get("href")
				{
					state
						.base
						.replace(val.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?);
				}

				for (k, v) in tag.attributes().unstable_raw().iter() {
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

					// TODO hashset
					if EVENT_ATTRIBUTES.contains(&attr) {
						let bounds = self.calculate_bounds(v.as_ref().unwrap_or(k))?;
						changes.add(HtmlRewrite::add_scram_attr(
							bounds,
							attr,
							v.as_ref()
								.map(|x| x.try_as_utf8_str().ok_or(RewriterError::NotUtf8))
								.transpose()?,
						));

						// TODO rewrite the attr
					}
				}

				if name == "script"
					&& let Some(Some(ty)) = tag.attributes().get("type")
					&& ty.try_as_utf8_str().ok_or(RewriterError::NotUtf8)? == "module"
					&& let Some(Some(src)) = tag.attributes().get("src")
				{
					let new_src = self.alloc.alloc_concat_strs_array([
						src.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?,
						"?type=module",
					]);

					changes.add(HtmlRewrite::replace_attr(
						self.calculate_bounds(src)?,
						new_src,
					));
				}

				if name == "meta"
					&& let Some(Some(eqiv)) = tag.attributes().get("http-equiv")
				{
					let mut val = StringBuilder::from_str_in(
						eqiv.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?,
						self.alloc,
					);
					val.as_mut_str().make_ascii_lowercase();

					if val == "content-security-policy" {
						changes.add(HtmlRewrite::remove_node(self.boundaries(tag)?));
					} else if val == "refresh" {
						// TODO
					}
				}

				Ok(())
			}
			_ => Ok(()),
		}
	}

	pub fn visit(
		&'data self,
		changes: &mut HtmlChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		let mut state = RewriteVisitorState { base: None };
		for node in self.tree.nodes() {
			self.visit_node(&mut state, node, changes)?;
		}
		Ok(())
	}
}

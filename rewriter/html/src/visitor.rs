use std::error::Error;

use oxc::{
	allocator::{Allocator, StringBuilder},
	span::Span,
};
use tl::{Bytes, HTMLTag, Node, NodeHandle, VDom};

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

pub type VisitorExternalToolCallback<T> = Box<
	dyn for<'alloc, 'data> Fn(
		&'alloc Allocator,
		VisitorExternalTool<'data>,
		&'data T,
	) -> Result<Option<&'alloc str>, Box<dyn Error + Sync + Send>>,
>;

pub struct Visitor<'alloc: 'data, 'data, T> {
	pub alloc: &'alloc Allocator,
	pub rules: &'data [RewriteRule<T>],
	pub external_tool_func: &'data VisitorExternalToolCallback<T>,
	pub rule_data: &'data T,

	pub data: &'data str,
	pub tree: VDom<'data>,
}

pub enum VisitorExternalTool<'data> {
	SetMetaBase(&'data str),
	Base64(&'data str),
	RewriteInlineScript { code: &'data str, module: bool },
	RewriteJsAttr { attr: &'data str, code: &'data str },
	RewriteHttpEquivContent(&'data str),
	RewriteCss(&'data str),
}

impl<'alloc, 'data, T> Visitor<'alloc, 'data, T> {
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

	fn get(&'data self, handle: NodeHandle) -> &'data Node<'data> {
		unsafe { handle.get(self.tree.parser()).unwrap_unchecked() }
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

	fn match_script_type(ty: Option<&str>) -> bool {
		ty.is_none_or(|x| {
			matches!(
				x,
				"application/javascript" | "text/javascript" | "module" | "importmap",
			)
		})
	}

	fn external_tool(
		&self,
		tool: VisitorExternalTool<'data>,
	) -> Result<Option<&'alloc str>, RewriterError> {
		(self.external_tool_func)(self.alloc, tool, self.rule_data).map_err(RewriterError::ExternalTool)
	}

	fn external_tool_val(
		&self,
		tool: VisitorExternalTool<'data>,
	) -> Result<&'alloc str, RewriterError> {
		self.external_tool(tool)?
			.ok_or(RewriterError::ExternalToolEmpty)
	}

	#[expect(clippy::too_many_lines)]
	fn visit_node(
		&'data self,
		node: &'data Node<'data>,
		changes: &mut HtmlChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		match node {
			Node::Tag(tag) => {
				let name = tag.name().try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
				if name == "base"
					&& let Some(Some(val)) = tag.attributes().get("href")
				{
					self.external_tool(VisitorExternalTool::SetMetaBase(
						val.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?,
					))?;
				}

				for (k, v) in tag.attributes().unstable_raw().iter() {
					let attr = k.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;

					if let Some(cb) = self.check_rules(name, attr)
						&& let Some(v) = v
					{
						let value = v.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
						let change = (cb)(self.alloc, value, self.rule_data)
							.map_err(RewriterError::Rewrite)?;

						let bounds = self.calculate_bounds(v)?;

						if let Some(change) = change {
							changes.add(HtmlRewrite::replace_attr(bounds, change));
						} else {
							let key = self.calculate_bounds(k)?;
							changes.add(HtmlRewrite::remove_attr(self.data, key, bounds));
						}
					}

					if EVENT_ATTRIBUTES.contains(&attr)
						&& let Some(v) = v
					{
						let value = v.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
						let bounds = self.calculate_bounds(v)?;
						let rewritten =
							self.external_tool_val(VisitorExternalTool::RewriteJsAttr {
								attr,
								code: value,
							})?;

						changes.add(HtmlRewrite::replace_attr(bounds, rewritten));
						changes.add(HtmlRewrite::add_scram_attr(bounds, attr, value));
					}
				}

				if name == "style"
					&& let Some(child) = tag.children().top().get(0)
					&& let Node::Raw(child) = self.get(*child)
				{
					let rewritten = self.external_tool_val(VisitorExternalTool::RewriteCss(
						child.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?,
					))?;

					changes.add(HtmlRewrite::replace(
						self.calculate_bounds(child)?,
						rewritten,
					));
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

				if name == "script"
					&& let ty = tag
						.attributes()
						.get("type")
						.and_then(|x| x)
						.map(|x| x.try_as_utf8_str().ok_or(RewriterError::NotUtf8))
						.transpose()? && Self::match_script_type(ty)
					&& let Some(child) = tag.children().top().get(0)
					&& let Some(child) = self.get(*child).as_raw()
				{
					let code = child.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
					let module = ty.is_some_and(|x| x == "module");

					let b64 = self.external_tool_val(VisitorExternalTool::Base64(code))?;
					let rewritten =
						self.external_tool_val(VisitorExternalTool::RewriteInlineScript {
							code,
							module,
						})?;

					changes.add(HtmlRewrite::add_scram_attr(
						self.calculate_bounds(tag.name())?,
						"script-source-src",
						b64,
					));
					changes.add(HtmlRewrite::replace(
						self.calculate_bounds(child)?,
						rewritten,
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
					} else if val == "refresh"
						&& let Some(Some(content)) = tag.attributes().get("content")
					{
						let val = content.try_as_utf8_str().ok_or(RewriterError::NotUtf8)?;
						let rewritten = self
							.external_tool_val(VisitorExternalTool::RewriteHttpEquivContent(val))?;
						changes.add(HtmlRewrite::replace_attr(
							self.calculate_bounds(content)?,
							rewritten,
						));
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
		for node in self.tree.nodes() {
			self.visit_node(node, changes)?;
		}
		Ok(())
	}
}

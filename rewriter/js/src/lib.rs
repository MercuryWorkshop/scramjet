use std::cell::RefCell;

use oxc::{
	allocator::{Allocator, Vec},
	ast_visit::Visit,
	diagnostics::OxcDiagnostic,
	parser::{ParseOptions, Parser},
	span::SourceType,
};
use thiserror::Error;

pub mod cfg;
mod rewrite;
mod changes;
mod visitor;

use cfg::{Config, Flags, UrlRewriter};
use changes::JsChanges;
use visitor::Visitor;

#[derive(Error, Debug)]
pub enum RewriterError {
	#[error("oxc panicked in parser: {0}")]
	OxcPanicked(String),
	#[error("out of bounds while applying range: {0}..{1})")]
	Oob(u32, u32),
	#[error("too much code added while applying changes")]
	AddedTooLarge,
	#[error("formatting error: {0}")]
	Formatting(#[from] std::fmt::Error),
	#[error("Already rewriting")]
	AlreadyRewriting,
	#[error("Not rewriting")]
	NotRewriting,
	#[error("JsChanges left over")]
	Leftover,
}

#[derive(Debug)]
pub struct RewriteResult<'alloc> {
	pub js: Vec<'alloc, u8>,
	pub sourcemap: Vec<'alloc, u8>,

	pub errors: std::vec::Vec<OxcDiagnostic>,
	pub flags: Flags,
}

pub struct Rewriter<E: UrlRewriter> {
	cfg: Config,
	url: E,

	jschanges: RefCell<Option<JsChanges<'static, 'static>>>,
}

impl<E: UrlRewriter> Rewriter<E> {
	fn take_jschanges<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
	) -> Result<JsChanges<'alloc, 'data>, RewriterError> {
		let mut slot = self
			.jschanges
			.try_borrow_mut()
			.map_err(|_| RewriterError::AlreadyRewriting)?;

		slot.take()
			.ok_or(RewriterError::AlreadyRewriting)
			.and_then(|x| {
				let mut x = unsafe {
					std::mem::transmute::<JsChanges<'static, 'static>, JsChanges<'alloc, 'data>>(x)
				};
				x.set_alloc(alloc)?;
				Ok(x)
			})
	}

	fn put_jschanges<'alloc: 'data, 'data>(
		&'data self,
		mut changes: JsChanges<'alloc, 'data>,
	) -> Result<(), RewriterError> {
		if !changes.empty() {
			return Err(RewriterError::Leftover);
		}

		let mut slot = self
			.jschanges
			.try_borrow_mut()
			.map_err(|_| RewriterError::AlreadyRewriting)?;

		if slot.is_some() {
			Err(RewriterError::NotRewriting)
		} else {
			changes.take_alloc()?;

			let changes = unsafe {
				std::mem::transmute::<JsChanges<'alloc, 'data>, JsChanges<'static, 'static>>(
					changes,
				)
			};

			slot.replace(changes);

			Ok(())
		}
	}

	pub fn new(cfg: Config, url_rewriter: E) -> Self {
		Self {
			cfg,
			url: url_rewriter,
			jschanges: RefCell::new(Some(JsChanges::new())),
		}
	}

	pub fn rewrite<'alloc: 'data, 'data>(
		&'data self,
		alloc: &'alloc Allocator,
		js: &'data str,
		flags: Flags,
	) -> Result<RewriteResult<'alloc>, RewriterError> {
		let source_type = SourceType::unambiguous()
			.with_javascript(true)
			.with_module(flags.is_module)
			.with_standard(true);
		let parsed = Parser::new(alloc, js, source_type)
			.with_options(ParseOptions {
				allow_v8_intrinsics: true,
				allow_return_outside_function: true,
				..Default::default()
			})
			.parse();

		if parsed.panicked {
			use std::fmt::Write;

			let mut errors = String::new();
			for error in parsed.errors {
				writeln!(errors, "{error}")?;
			}
			return Err(RewriterError::OxcPanicked(errors));
		}

		let jschanges = self.take_jschanges(alloc)?;

		let mut visitor = Visitor {
			alloc,
			jschanges,

			config: &self.cfg,
			rewriter: &self.url,
			flags,
		};
		visitor.visit_program(&parsed.program);
		let mut jschanges = visitor.jschanges;

		let changed = jschanges.perform(js, &self.cfg, &visitor.flags)?;

		self.put_jschanges(jschanges)?;

		let js: Vec<'alloc, u8> = changed.js;
		let sourcemap: Vec<'alloc, u8> = changed.sourcemap;

		Ok(RewriteResult {
			js,
			sourcemap,
			errors: parsed.errors,
			flags: visitor.flags,
		})
	}
}

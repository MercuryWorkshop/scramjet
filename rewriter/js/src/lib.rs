use oxc::{
	allocator::{Allocator, String, Vec},
	ast_visit::Visit,
	diagnostics::OxcDiagnostic,
	parser::{ParseOptions, Parser},
	span::SourceType,
};
use thiserror::Error;

pub mod cfg;
mod changes;
mod visitor;
mod changeset;

use cfg::Config;
use changes::{JsChangeResult, JsChanges};
use visitor::Visitor;

#[derive(Error, Debug)]
pub enum RewriterError {
	#[error("oxc panicked in parser: {0}")]
	OxcPanicked(std::string::String),
	#[error("out of bounds while applying range: {0}..{1})")]
	Oob(u32, u32),
	#[error("too much code added while applying changes")]
	AddedTooLarge,
	#[error("formatting error: {0}")]
	Formatting(#[from] std::fmt::Error),
}

#[derive(Debug)]
pub struct RewriteResult<'alloc> {
	pub js: Vec<'alloc, u8>,
	pub sourcemap: Vec<'alloc, u8>,
	pub errors: std::vec::Vec<OxcDiagnostic>,
}

pub fn rewrite<'alloc, 'data, E>(
	alloc: &'alloc Allocator,
	js: &'data str,
	config: Config<'alloc, E>,
	module: bool,
	capacity: usize,
) -> Result<RewriteResult<'alloc>, RewriterError>
where
	E: Fn(&str, &'alloc Allocator) -> String<'alloc>,
{
	let source_type = SourceType::unambiguous()
		.with_javascript(true)
		.with_module(module)
		.with_standard(true);
	let ret = Parser::new(alloc, js, source_type)
		.with_options(ParseOptions {
			allow_v8_intrinsics: true,
			allow_return_outside_function: true,
			..Default::default()
		})
		.parse();

	if ret.panicked {
		use std::fmt::Write;

		let mut errors = std::string::String::new();
		for error in ret.errors {
			writeln!(errors, "{error}")?;
		}
		return Err(RewriterError::OxcPanicked(errors));
	}

	let mut visitor = Visitor {
		jschanges: JsChanges::new(alloc, capacity),
		config,
		alloc,
	};

	visitor.visit_program(&ret.program);
	let Visitor {
		mut jschanges,
		config,
		alloc: _,
	} = visitor;

	let JsChangeResult { js, sourcemap } = jschanges.perform(js, &config)?;

	Ok(RewriteResult {
		js,
		sourcemap,
		errors: ret.errors,
	})
}

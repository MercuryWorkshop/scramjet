use std::ops::Range;

use cfg::Config;
use changes::{JsChangeResult, JsChanges, Rewrite};
use oxc::{
	allocator::Allocator,
	ast::Visit,
	diagnostics::OxcDiagnostic,
	parser::{ParseOptions, Parser},
	span::SourceType,
};
use thiserror::Error;
use visitor::Visitor;

pub mod cfg;
pub mod changes;
mod visitor;

#[derive(Error, Debug)]
pub enum RewriterError {
	#[error("oxc panicked in parser: {0:?}")]
	OxcPanicked(Vec<OxcDiagnostic>),
	#[error("out of bounds while applying range: {0:?})")]
	Oob(Range<usize>),
}

#[derive(Debug)]
pub struct RewriteResult {
	pub js: Vec<u8>,
	pub sourcemap: Vec<u8>,
	pub errors: Vec<OxcDiagnostic>,
}

pub fn rewrite<E>(js: &str, config: Config<E>) -> Result<RewriteResult, RewriterError>
where
	E: Fn(String) -> String,
	E: Clone,
{
	let allocator = Allocator::default();
	let source_type = SourceType::default();
	let ret = Parser::new(&allocator, js, source_type)
		.with_options(ParseOptions {
			parse_regular_expression: false, // default
			allow_return_outside_function: true,
			preserve_parens: true, // default
		})
		.parse();

	if ret.panicked {
		return Err(RewriterError::OxcPanicked(ret.errors));
	}

	let mut visitor = Visitor {
		jschanges: JsChanges::new(),
		config,
	};
	visitor.visit_program(&ret.program);
	let Visitor {
		mut jschanges,
		config,
	} = visitor;

	let JsChangeResult { js, sourcemap } = jschanges.perform(js, &config)?;

	Ok(RewriteResult {
		js,
		sourcemap,
		errors: ret.errors,
	})
}

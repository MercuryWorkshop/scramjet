use cfg::Config;
use changes::{JsChangeResult, JsChanges};
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
	#[error("oxc panicked in parser: {0}")]
	OxcPanicked(String),
	#[error("out of bounds while applying range: {0}..{1})")]
	Oob(usize, usize),
}

#[derive(Debug)]
pub struct RewriteResult {
	pub js: Vec<u8>,
	pub sourcemap: Vec<u8>,
	pub sourcetag: String,
	pub errors: Vec<OxcDiagnostic>,
}

pub fn rewrite<E>(
	js: &str,
	module: bool,
	capacity: usize,
	config: Config<E>,
) -> Result<RewriteResult, RewriterError>
where
	E: Fn(String) -> String,
	E: Clone,
{
	let allocator = Allocator::default();
	let source_type = SourceType::unambiguous()
		.with_javascript(true)
		.with_module(module)
		.with_standard(true);
	let ret = Parser::new(&allocator, js, source_type)
		.with_options(ParseOptions {
			parse_regular_expression: false, // default
			allow_return_outside_function: true,
			preserve_parens: true, // default
		})
		.parse();

	if ret.panicked {
		let mut errors = String::new();
		for error in ret.errors {
			errors.push_str(&format!("{error}"));
			errors.push('\n');
		}
		return Err(RewriterError::OxcPanicked(errors));
	}

	let mut visitor = Visitor {
		jschanges: JsChanges::new(capacity),
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
		sourcetag: config.sourcetag,
		errors: ret.errors,
	})
}

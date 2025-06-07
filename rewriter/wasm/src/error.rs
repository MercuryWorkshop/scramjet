use std::cell::BorrowMutError;

use html::RewriterError as HtmlRewriterError;
use js::RewriterError as JsRewriterError;
use js_sys::Error;
use thiserror::Error;
use wasm_bindgen::{JsError, JsValue};

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("JS: {0}")]
	Js(String),
	#[error("JS Rewriter: {0}")]
	JsRewriter(#[from] JsRewriterError),
	#[error("HTML Rewriter: {0}")]
	HtmlRewriter(#[from] HtmlRewriterError),

	#[error("str fromutf8 error: {0}")]
	Str(#[from] std::str::Utf8Error),
	#[error("reflect set failed: {0}")]
	ReflectSetFail(String),
	#[error("Rewriter was already rewriting")]
	AlreadyRewriting(#[from] BorrowMutError),

	#[error("{0} was not {1}")]
	Not(&'static str, &'static str),
}

impl From<JsValue> for RewriterError {
	fn from(value: JsValue) -> Self {
		Self::Js(Error::from(value).to_string().into())
	}
}

impl From<RewriterError> for JsValue {
	fn from(value: RewriterError) -> Self {
		JsError::from(value).into()
	}
}

impl RewriterError {
	pub fn not_str(x: &'static str) -> Self {
		Self::Not(x, "string")
	}

	pub fn not_arr(x: &'static str) -> Self {
		Self::Not(x, "array")
	}

	pub fn not_fn(x: &'static str) -> Self {
		Self::Not(x, "function")
	}

	pub fn not_bool(x: &'static str) -> Self {
		Self::Not(x, "bool")
	}
}

pub type Result<T> = std::result::Result<T, RewriterError>;

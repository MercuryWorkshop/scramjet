use std::cell::BorrowMutError;

use js_sys::Error;
use js::RewriterError as JsRewriterError;
use thiserror::Error;
use wasm_bindgen::{JsError, JsValue};

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("JS: {0}")]
	Js(String),
	#[error("str fromutf8 error: {0}")]
	Str(#[from] std::str::Utf8Error),
	#[error("JS Rewriter: {0}")]
	JsRewriter(#[from] JsRewriterError),
	#[error("reflect set failed: {0}")]
	ReflectSetFail(String),
	#[error("Rewriter was already rewriting")]
	AlreadyRewriting(#[from] BorrowMutError),

	#[error("{0} was not {1}")]
	Not(String, &'static str),
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
	pub fn not_str(x: &str) -> Self {
		Self::Not(x.to_string(), "string")
	}

	pub fn not_fn(x: &str) -> Self {
		Self::Not(x.to_string(), "function")
	}

	pub fn not_bool(x: &str) -> Self {
		Self::Not(x.to_string(), "bool")
	}
}

pub type Result<T> = std::result::Result<T, RewriterError>;

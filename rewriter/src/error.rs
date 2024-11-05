use js_sys::Error;
use thiserror::Error;
use wasm_bindgen::{JsError, JsValue};

#[derive(Debug, Error)]
pub enum RewriterError {
	#[error("JS: {0}")]
	Js(String),
	#[error("URL parse error: {0}")]
	Url(#[from] url::ParseError),
	#[error("str fromutf8 error: {0}")]
	Str(#[from] std::str::Utf8Error),
	#[error("reflect set failed: {0}")]
	ReflectSetFail(String),

	#[error("{0} was not {1}")]
	Not(String, &'static str),
	#[error("❗❗❗ ❗❗❗ REWRITER OFFSET OOB FAIL ❗❗❗ ❗❗❗")]
	Oob,
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

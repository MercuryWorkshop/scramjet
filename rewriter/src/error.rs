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

	#[error("{0} was not {1}")]
	Not(String, &'static str),
	#[error("❗❗❗ ❗❗❗ REWRITER OFFSET OOB FAIL ❗❗❗ ❗❗❗")]
	Oob,
}

impl From<JsValue> for RewriterError {
	fn from(value: JsValue) -> Self {
		Self::Js(format!("{:?}", value))
	}
}

impl From<RewriterError> for JsValue {
	fn from(value: RewriterError) -> Self {
		JsError::from(value).into()
	}
}

impl RewriterError {
	pub fn not_str(x: &str, obj: &JsValue) -> Self {
		Self::Not(format!("{:?} in {:?}", x, obj), "string")
	}

	pub fn not_fn(obj: JsValue) -> Self {
		Self::Not(format!("{:?}", obj), "function")
	}

	pub fn not_bool(obj: &JsValue) -> Self {
		Self::Not(format!("{:?}", obj), "bool")
	}
}

pub type Result<T> = std::result::Result<T, RewriterError>;

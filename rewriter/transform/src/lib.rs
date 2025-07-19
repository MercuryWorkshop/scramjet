use std::{fmt::Display, marker::PhantomData};

use oxc::{
	allocator::{Allocator, Vec},
	span::Span,
};
use thiserror::Error;

pub mod transform;
use transform::{Transform, TransformType};

#[derive(Debug, Error)]
pub enum TransformError {
	#[cfg(not(feature = "debug"))]
	#[error("out of bounds while applying range {0}..{1} for {2} (span {3}..{4})")]
	Oob(u32, u32, &'static str, u32, u32),
	#[cfg(feature = "debug")]
	#[error(
		"out of bounds while applying range {0}..{1} for {2} (span {3}..{4}, last few spans: {5})"
	)]
	Oob(u32, u32, &'static str, u32, u32, LastSpans),

	#[cfg(feature = "debug")]
	#[error("Spans inside each other, all spans: {0}")]
	InvalidSpans(LastSpans),

	#[error("too much code added while applying changes at cursor {0}")]
	AddedTooLarge(u32),
	#[error("Allocator already set")]
	AllocSet,
	#[error("Allocator not set")]
	AllocUnset,
}

#[cfg(feature = "debug")]
#[derive(Debug)]
pub struct LastSpans(std::vec::Vec<(Span, std::string::String)>);
#[cfg(feature = "debug")]
impl Display for LastSpans {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "\n(current) ")?;
		for span in &self.0 {
			writeln!(f, "{}..{}: {}", span.0.start, span.0.end, span.1)?;
		}

		Ok(())
	}
}

pub struct TransformResult<'alloc> {
	pub source: Vec<'alloc, u8>,
	pub map: Vec<'alloc, u8>,
}

pub struct Transformer<'alloc, 'data, T: Transform<'data>> {
	phantom: PhantomData<&'data str>,
	alloc: Option<&'alloc Allocator>,
	inner: std::vec::Vec<T>,
}

impl<'data, T: Transform<'data>> Default for Transformer<'_, 'data, T> {
	fn default() -> Self {
		Self::new()
	}
}

impl<'alloc, 'data, T: Transform<'data>> Transformer<'alloc, 'data, T> {
	pub fn new() -> Self {
		Self {
			phantom: PhantomData,
			inner: std::vec::Vec::new(),
			alloc: None,
		}
	}

	pub fn add(&mut self, rewrite: impl IntoIterator<Item = T>) {
		self.inner.extend(rewrite);
	}

	pub fn set_alloc(&mut self, alloc: &'alloc Allocator) -> Result<(), TransformError> {
		if self.alloc.is_some() {
			Err(TransformError::AllocSet)
		} else {
			self.alloc.replace(alloc);
			Ok(())
		}
	}

	pub fn take_alloc(&mut self) -> Result<(), TransformError> {
		self.alloc
			.take()
			.ok_or(TransformError::AllocUnset)
			.map(|_| ())
	}

	pub fn get_alloc(&self) -> Result<&'alloc Allocator, TransformError> {
		self.alloc.ok_or(TransformError::AllocUnset)
	}

	pub fn empty(&self) -> bool {
		self.inner.is_empty()
	}

	pub fn perform(
		&mut self,
		js: &'data str,
		data: &T::ToLowLevelData,
		build_map: bool,
	) -> Result<TransformResult<'alloc>, TransformError> {
		let mut itoa = itoa::Buffer::new();

		let alloc = self.get_alloc()?;

		let mut cursor = 0;
		let mut offset = 0i32;
		let mut buffer = Vec::with_capacity_in(js.len() * 2, alloc);

		#[cfg(feature = "debug")]
		let mut debug_vec = std::vec::Vec::new();

		macro_rules! tryget {
			($reason:literal, $start:ident..$end:ident, $span:ident) => {{
				let ret = js.get($start as usize..$end as usize);
				#[cfg(not(feature = "debug"))]
				{
					ret.ok_or_else(|| {
						TransformError::Oob($start, $end, $reason, $span.start, $span.end)
					})?
				}
				#[cfg(feature = "debug")]
				{
					ret.ok_or_else(|| {
						TransformError::Oob(
							$start,
							$end,
							$reason,
							$span.start,
							$span.end,
							LastSpans(debug_vec.iter().rev().cloned().take(6).collect()),
						)
					})?
				}
			}};
		}

		// insert has a 9 byte size, replace has a 13 byte minimum and usually it's like 5 bytes
		// for the old str added on so use 16 as a really rough estimate
		let mut map = if build_map {
			let mut map = Vec::with_capacity_in((self.inner.len() * 16) + 4, alloc);
			map.extend_from_slice(&(self.inner.len() as u32).to_le_bytes());
			map
		} else {
			Vec::new_in(alloc)
		};

		self.inner.sort();

		#[cfg(feature = "debug")]
		{
			let mut last_end = 0;
			for change in &self.inner {
				let span = change.span();
				if last_end > span.start {
					let vec = self
						.inner
						.drain(..)
						.map(|x| {
							(
								x.span(),
								x.into_low_level(data, 0).to_string(&mut itoa, alloc),
							)
						})
						.collect();
					return Err(TransformError::InvalidSpans(LastSpans(vec)));
				}
				last_end = span.end;
			}
		}

		for change in self.inner.drain(..) {
			let span = change.span();
			let Span { start, end, .. } = span;

			let transform = change.into_low_level(data, offset);
			#[cfg(feature = "debug")]
			debug_vec.push((span, transform.to_string(&mut itoa, alloc)));

			buffer.extend_from_slice(tryget!("cursor -> start", cursor..start, span).as_bytes());

			let len = transform.apply(&mut itoa, &mut buffer);
			if build_map {
				// pos
				map.extend_from_slice(&start.wrapping_add_signed(offset).to_le_bytes());
				// size
				map.extend_from_slice(&len.to_le_bytes());
			}

			match transform.ty {
				TransformType::Insert => {
					buffer.extend_from_slice(
						tryget!("insert: start -> end", start..end, span).as_bytes(),
					);

					if build_map {
						// INSERT op
						map.push(0);
					}

					offset = offset.wrapping_add_unsigned(len);
				}
				TransformType::Replace => {
					if build_map {
						// REPLACE op
						map.push(1);
						// len
						map.extend_from_slice(&(end - start).to_le_bytes());
						// oldstr
						map.extend_from_slice(
							tryget!("replace: start -> end", start..end, span).as_bytes(),
						);
					}

					let len =
						i32::try_from(len).map_err(|_| TransformError::AddedTooLarge(cursor))?;
					let diff = len.wrapping_sub_unsigned(end - start);
					offset = offset.wrapping_add(diff);
				}
			}

			cursor = end;
		}

		let js_len = js.len() as u32;
		let span = Span::new(0, js_len);
		buffer.extend_from_slice(tryget!("cursor -> js end", cursor..js_len, span).as_bytes());

		Ok(TransformResult {
			source: buffer,
			map,
		})
	}
}

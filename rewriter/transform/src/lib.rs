use oxc::{
	allocator::{Allocator, Vec},
	span::Span,
};
use thiserror::Error;

pub mod transform;
use transform::{Transform, TransformType};

#[derive(Debug, Error)]
pub enum TransformError {
	#[error("out of bounds while applying range {0}..{1}")]
	Oob(u32, u32),
	#[error("too much code added while applying changes at cursor {0}")]
	AddedTooLarge(u32),
	#[error("Allocator already set")]
	AllocSet,
	#[error("Allocator not set")]
	AllocUnset,
}

pub struct TransformResult<'alloc> {
	pub js: Vec<'alloc, u8>,
	pub sourcemap: Vec<'alloc, u8>,
}

pub struct Transformer<'alloc, T: Transform> {
	alloc: Option<&'alloc Allocator>,
	inner: std::vec::Vec<T>,
}

impl<T: Transform> Default for Transformer<'_, T> {
	fn default() -> Self {
		Self::new()
	}
}

impl<'alloc, T: Transform> Transformer<'alloc, T> {
	pub fn new() -> Self {
		Self {
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
		js: &str,
		data: &T::ToLowLevelData,
	) -> Result<TransformResult<'alloc>, TransformError> {
		let mut itoa = itoa::Buffer::new();

		let alloc = self.get_alloc()?;

		let mut cursor = 0;
		let mut offset = 0i32;
		let mut buffer = Vec::with_capacity_in(js.len() * 2, alloc);

		macro_rules! tryget {
			($start:ident..$end:ident) => {
				js.get($start as usize..$end as usize)
					.ok_or_else(|| TransformError::Oob($start, $end))?
			};
		}

		// insert has a 9 byte size, replace has a 13 byte minimum and usually it's like 5 bytes
		// for the old str added on so use 16 as a really rough estimate
		let mut map = Vec::with_capacity_in((self.inner.len() * 16) + 4, alloc);
		map.extend_from_slice(&(self.inner.len() as u32).to_le_bytes());

		self.inner.sort();

		for change in self.inner.drain(..) {
			let Span { start, end, .. } = change.span();

			buffer.extend_from_slice(tryget!(cursor..start).as_bytes());

			let transform = change.into_low_level(data, cursor);
			let len = transform.apply(&mut itoa, &mut buffer);
			// pos
			map.extend_from_slice(&start.wrapping_add_signed(offset).to_le_bytes());
			// size
			map.extend_from_slice(&len.to_le_bytes());

			match transform.ty {
				TransformType::Insert => {
					buffer.extend_from_slice(tryget!(start..end).as_bytes());

					// INSERT op
					map.push(0);

					offset = offset.wrapping_add_unsigned(len);
				}
				TransformType::Replace => {
					// REPLACE op
					map.push(1);
					// len
					map.extend_from_slice(&(end - start).to_le_bytes());
					// oldstr
					map.extend_from_slice(tryget!(start..end).as_bytes());

					let len =
						i32::try_from(len).map_err(|_| TransformError::AddedTooLarge(cursor))?;
					let diff = len.wrapping_sub_unsigned(end - start);
					offset = offset.wrapping_add(diff);
				}
			}

			cursor = end;
		}

		let js_len = js.len() as u32;
		buffer.extend_from_slice(tryget!(cursor..js_len).as_bytes());

		Ok(TransformResult {
			js: buffer,
			sourcemap: map,
		})
	}
}

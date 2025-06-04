use oxc::{allocator::Vec, ast::ast::AssignmentOperator, span::{Atom, Span}};
use smallvec::SmallVec;

pub enum Change<'a> {
	Str(&'a str),
	U32(u32),
}

impl Change<'_> {
	fn eval(&self, itoa: &mut itoa::Buffer, buffer: &mut Vec<'_, u8>) -> usize {
		match self {
			Change::Str(x) => {
				buffer.extend_from_slice(x.as_bytes());
				x.len()
			}
			Change::U32(x) => {
				let x = itoa.format(*x);
				buffer.extend_from_slice(x.as_bytes());
				x.len()
			}
		}
	}
}

impl<'a> From<&'a str> for Change<'a> {
	fn from(value: &'a str) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<&&'a str> for Change<'a> {
	fn from(value: &&'a str) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<&'a String> for Change<'a> {
	fn from(value: &'a String) -> Self {
		Self::Str(value)
	}
}

impl<'a> From<Atom<'a>> for Change<'a> {
	fn from(value: Atom<'a>) -> Self {
		Self::Str(value.as_str())
	}
}

impl From<AssignmentOperator> for Change<'static> {
	fn from(value: AssignmentOperator) -> Self {
		Self::Str(value.as_str())
	}
}

impl From<u32> for Change<'static> {
	fn from(value: u32) -> Self {
		Self::U32(value)
	}
}

pub type Changes<'a> = SmallVec<[Change<'a>; 8]>;

pub enum TransformType {
	Insert,
	Replace,
}

pub trait Transform: Ord {
	type ToLowLevelData;

	fn span(&self) -> Span;
	fn into_low_level(self, data: &Self::ToLowLevelData, cursor: u32) -> TransformLL;
}

pub struct TransformLL<'a> {
	pub ty: TransformType,
	pub change: Changes<'a>,
}

impl<'a> TransformLL<'a> {
	pub fn insert(change: Changes<'a>) -> Self {
		Self {
			ty: TransformType::Insert,
			change,
		}
	}

	pub fn replace(change: Changes<'a>) -> Self {
		Self {
			ty: TransformType::Replace,
			change,
		}
	}

	pub fn apply(&self, itoa: &mut itoa::Buffer, buffer: &mut Vec<'_, u8>) -> u32 {
		let mut len = 0;

		for str in &self.change {
			len += str.eval(itoa, buffer) as u32;
		}

		len
	}
}

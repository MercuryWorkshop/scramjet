#![allow(dead_code, clippy::unused_self)]

use oxc::allocator::{Allocator, Vec};

pub struct VecChangeSet<'alloc, T: Ord> {
	inner: Vec<'alloc, T>,
}

impl<'alloc, T: Ord> VecChangeSet<'alloc, T> {
	pub fn new(alloc: &'alloc Allocator, capacity: usize) -> Self {
		Self {
			inner: Vec::with_capacity_in(capacity, alloc),
		}
	}

	pub fn add(&mut self, t: T) {
		self.inner.push(t);
	}

	pub fn sort(&mut self) {
		self.inner.sort();
	}

	pub fn len(&self) -> usize {
		self.inner.len()
	}

	pub fn iter(&self) -> impl Iterator<Item = &T> {
		self.inner.iter()
	}
}

pub type ChangeSet<'alloc, T> = VecChangeSet<'alloc, T>;

use oxc::allocator::StringBuilder;

pub struct Config<'alloc, E>
where
	E: Fn(&str, &mut StringBuilder<'alloc>),
{
	pub prefix: &'alloc str,
	pub sourcetag: &'alloc str,
	pub base: &'alloc str,

	pub wrapfn: &'alloc str,
	pub wrapthisfn: &'alloc str,
	pub importfn: &'alloc str,
	pub rewritefn: &'alloc str,
	pub setrealmfn: &'alloc str,
	pub metafn: &'alloc str,
	pub pushsourcemapfn: &'alloc str,

	/// URL REWRITER IS RESPONSIBLE FOR ADDING BASE
	pub urlrewriter: E,

	pub capture_errors: bool,
	pub scramitize: bool,
	pub do_sourcemaps: bool,
	pub strict_rewrites: bool,
}

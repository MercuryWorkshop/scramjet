use oxc::allocator::StringBuilder;

pub trait UrlRewriter {
	fn rewrite<'alloc>(&self, url: &str, builder: &mut StringBuilder<'alloc>);
}

pub struct Config<E: UrlRewriter> {
	pub prefix: String,
	pub sourcetag: String,
	pub base: String,

	pub wrapfn: String,
	pub wrapthisfn: String,
	pub importfn: String,
	pub rewritefn: String,
	pub setrealmfn: String,
	pub metafn: String,
	pub pushsourcemapfn: String,

	pub urlrewriter: E,
}

pub struct Flags {
	pub is_module: bool,

	pub capture_errors: bool,
	pub scramitize: bool,
	pub do_sourcemaps: bool,
	pub strict_rewrites: bool,
}

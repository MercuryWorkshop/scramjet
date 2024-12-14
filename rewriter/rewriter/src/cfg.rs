#[derive(Clone)]
pub struct Config<E>
where
	E: Fn(String) -> String,
	E: Clone,
{
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

	/// URL REWRITER IS RESPONSIBLE FOR ADDING BASE
	pub urlrewriter: E,

	pub capture_errors: bool,
	pub scramitize: bool,
	pub do_sourcemaps: bool,
	pub strict_rewrites: bool,
}

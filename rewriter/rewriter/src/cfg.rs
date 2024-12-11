use url::Url;

pub struct Config {
    pub prefix: String,
	pub sourcetag: String,
	pub base: Url,

    pub wrapfn: String,
    pub wrapthisfn: String,
    pub importfn: String,
    pub rewritefn: String,
    pub setrealmfn: String,
    pub metafn: String,
    pub pushsourcemapfn: String,

    pub encoder: EncodeFn,

    pub capture_errors: bool,
    pub scramitize: bool,
    pub do_sourcemaps: bool,
    pub strict_rewrites: bool,
}

pub type EncodeFn = Box<dyn Fn(String) -> String>;

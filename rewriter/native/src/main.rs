use std::{
	env,
	ffi::OsString,
	fs,
	path::PathBuf,
	sync::Arc,
	time::{Duration, Instant},
};

use anyhow::{Context, Result};
use clap::Parser;
use html::{Rewriter, attrmap, rule::RewriteRule};
use oxc::{
	allocator::{Allocator, StringBuilder},
	diagnostics::NamedSource,
};
use rewriter::NativeRewriter;

mod rewriter;
mod test_runner;

#[derive(Parser)]
pub struct RewriterOptions {
	#[clap(long, default_value = "/scrammedjet/")]
	prefix: String,
	#[clap(long, default_value = "$wrap")]
	wrapfn: String,
	#[clap(long, default_value = "$gwrap")]
	wrapthisfn: String,
	#[clap(long, default_value = "$import")]
	importfn: String,
	#[clap(long, default_value = "$rewrite")]
	rewritefn: String,
	#[clap(long, default_value = "$meta")]
	metafn: String,
	#[clap(long, default_value = "$setrealm")]
	setrealmfn: String,
	#[clap(long, default_value = "$pushsourcemap")]
	pushsourcemapfn: String,

	#[clap(long, default_value = "https://google.com/glorngle/si.js")]
	base: String,
	#[clap(long, default_value = "glongle1")]
	sourcetag: String,

	#[clap(long, default_value_t = false)]
	is_module: bool,
	#[clap(long, default_value_t = false)]
	capture_errors: bool,
	#[clap(long, default_value_t = false)]
	do_sourcemaps: bool,
	#[clap(long, default_value_t = false)]
	scramitize: bool,
	#[clap(long, default_value_t = false)]
	strict_rewrites: bool,
}

impl Default for RewriterOptions {
	fn default() -> Self {
		Self::parse_from(std::iter::empty::<OsString>())
	}
}

#[derive(Parser)]
#[command(version = clap::crate_version!())]
pub enum Cli {
	/// Rewrite a file
	Rewrite {
		file: PathBuf,
		#[clap(flatten)]
		config: RewriterOptions,
	},
	/// Rewrite a file multiple times for flamegraphing
	Bench {
		file: PathBuf,
		iterations: u32,
		#[clap(flatten)]
		config: RewriterOptions,
	},
	Html {
		file: PathBuf,
	},
}

fn main() -> Result<()> {
	let args = Cli::parse();

	match args {
		Cli::Rewrite { file, config } => {
			let mut rewriter = NativeRewriter::new(&config);

			let data = fs::read_to_string(file).context("failed to read file")?;

			let res = rewriter.rewrite(&data, &config)?;

			let source =
				Arc::new(NamedSource::new(data.clone(), config.base).with_language("javascript"));

			println!(
				"rewritten:\n{}",
				str::from_utf8(&res.js).context("failed to parse rewritten js")?
			);

			let unrewritten = NativeRewriter::unrewrite(&res);

			eprintln!("errors:");
			for err in res.errors {
				eprintln!("{}", err.with_source_code(source.clone()));
			}

			rewriter.reset();

			println!(
				"unrewritten matches orig: {}",
				data.as_bytes() == unrewritten.as_slice()
			);
		}
		Cli::Bench {
			file,
			iterations,
			config,
		} => {
			let mut rewriter = NativeRewriter::new(&config);

			let data = fs::read_to_string(file).context("failed to read file")?;
			let mut duration = Duration::from_secs(0);

			let cnt = iterations * 100;

			for x in 1..=cnt {
				let before = Instant::now();
				rewriter
					.rewrite(&data, &config)
					.context("failed to rewrite")?;
				let after = Instant::now();

				rewriter.reset();

				duration += after - before;

				if x % 100 == 0 {
					println!("{x}...");
				}
			}

			println!("iterations: {cnt}");
			println!("total time: {duration:?}");
			println!("avg time: {:?}", duration / cnt);
		}
		Cli::Html { file } => {
			let data = fs::read_to_string(file).context("failed to read file")?;

			let mut alloc = Allocator::new();

			let rules = vec![RewriteRule {
				attrs: attrmap!({
					"href": ["a", "link"]
				}),
				func: Box::new(|alloc, x, ()| {
					let mut build = StringBuilder::from_str_in(x, alloc);
					build.push_str(" :3");
					Ok(Some(build.into_str()))
				}),
			}];

			let rewriter = Rewriter::new(rules)?;

			let ret = rewriter.rewrite(&alloc, &data, &())?;

			println!("{}", str::from_utf8(&ret)?);

			alloc.reset();
		}
	}

	Ok(())
}

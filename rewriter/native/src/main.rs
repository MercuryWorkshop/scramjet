use std::{
	env, fs,
	path::PathBuf,
	sync::Arc,
	time::{Duration, Instant},
};

use anyhow::{Context, Result};
use clap::Parser;
use oxc::diagnostics::NamedSource;
use rewriter::NativeRewriter;

mod rewriter;
mod test_runner;

#[derive(Parser)]
#[command(version = clap::crate_version!())]
pub enum Cli {
	/// Rewrite a file
	Rewrite { file: PathBuf },
	/// Rewrite a file multiple times for flamegraphing
	Bench { file: PathBuf, iterations: u32 },
}

fn main() -> Result<()> {
	let args = Cli::parse();

	let mut rewriter = NativeRewriter::new().context("failed to make rewriter")?;

	match args {
		Cli::Rewrite { file } => {
			let data = fs::read_to_string(file).context("failed to read file")?;

			let res = rewriter.rewrite(&data)?;

			let source = Arc::new(
				NamedSource::new(data.clone(), "https://google.com/glorngle/si.js")
					.with_language("javascript"),
			);

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
		Cli::Bench { file, iterations } => {
			let data = fs::read_to_string(file).context("failed to read file")?;
			let mut duration = Duration::from_secs(0);

			let cnt = iterations * 100;

			for x in 1..=cnt {
				let before = Instant::now();
				rewriter.rewrite(&data).context("failed to rewrite")?;
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
	}

	Ok(())
}

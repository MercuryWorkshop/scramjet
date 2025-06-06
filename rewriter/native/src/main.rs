use std::{
	env, fs,
	str::FromStr,
	sync::Arc,
	time::{Duration, Instant},
};

use anyhow::{Context, Result};
use oxc::diagnostics::NamedSource;
use rewriter::NativeRewriter;

mod rewriter;
mod test_runner;

fn main() -> Result<()> {
	let file = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
	let data = fs::read_to_string(file).context("failed to read file")?;
	let bench = env::args().nth(2).map(|x| usize::from_str(&x));

	let mut rewriter = NativeRewriter::new().context("failed to make rewriter")?;

	if let Some(cnt) = bench.transpose().context("invalid bench size")? {
		let mut duration = Duration::from_secs(0);

		let cnt = cnt * 100;

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
		println!("avg time: {:?}", duration / cnt as u32);
	} else {
		println!("orig:\n{data}");

		let res = rewriter.rewrite(&data)?;

		let source = Arc::new(
			NamedSource::new(data.clone(), "https://google.com/glorngle/si.js")
				.with_language("javascript"),
		);
		eprintln!("errors:");
		for err in res.errors.clone() {
			eprintln!("{}", err.with_source_code(source.clone()));
		}

		println!(
			"rewritten:\n{}",
			str::from_utf8(&res.js).context("failed to parse rewritten js")?
		);

		let unrewritten = NativeRewriter::unrewrite(&res);

		rewriter.reset();

		println!(
			"unrewritten matches orig: {}",
			data.as_bytes() == unrewritten.as_slice()
		);
	}

	Ok(())
}

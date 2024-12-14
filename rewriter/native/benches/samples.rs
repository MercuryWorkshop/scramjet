use std::str::FromStr;

use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use rewriter::{cfg::Config, rewrite};
use url::Url;
use urlencoding::encode;

pub fn bench(c: &mut Criterion) {
	let discord = include_str!("../sample/discord.js");
	let google = include_str!("../sample/google.js");
	let url = Url::from_str("https://google.com/glorngle/si.js").expect("failed to make url");

	let cfg = Config {
		prefix: "/scrammedjet/".to_string(),

		base: url.to_string(),
		urlrewriter: Box::new(move |x: String| encode(url.join(&x).unwrap().as_str()).to_string()),

		sourcetag: "glongle1".to_string(),

		wrapfn: "$wrap".to_string(),
		wrapthisfn: "$gwrap".to_string(),
		importfn: "$import".to_string(),
		rewritefn: "$rewrite".to_string(),
		metafn: "$meta".to_string(),
		setrealmfn: "$setrealm".to_string(),
		pushsourcemapfn: "$pushsourcemap".to_string(),

		capture_errors: true,
		do_sourcemaps: true,
		scramitize: false,
		strict_rewrites: true,
	};

	c.bench_with_input(
		BenchmarkId::new("rewrite/samples", "discord"),
		&(discord, cfg.clone()),
		|b, input| {
			b.iter_batched(
				|| input.clone(),
				|x| rewrite(x.0, x.1),
				BatchSize::SmallInput,
			)
		},
	);

	c.bench_with_input(
		BenchmarkId::new("rewrite/samples", "google"),
		&(google, cfg.clone()),
		|b, input| {
			b.iter_batched(
				|| input.clone(),
				|x| rewrite(x.0, x.1),
				BatchSize::SmallInput,
			)
		},
	);
}

criterion_group!(samples, bench);
criterion_main!(samples);

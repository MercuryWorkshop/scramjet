import { site } from "./lib.ts";

const bigMap = (n: number, scopes = 0) => {
	const imports: Record<string, string> = {};
	for (let i = 0; i < n; i++) imports["pkg-" + i] = "/p/" + i + ".js";
	const sc: Record<string, Record<string, string>> = {};
	for (let s = 0; s < scopes; s++) {
		const m: Record<string, string> = {};
		for (let i = 0; i < 20; i++) m["dep-" + i] = "/p/s" + s + "-" + i + ".js";
		sc["/scope" + s + "/"] = m;
	}
	return JSON.stringify(
		scopes
			? {
					imports,
					scopes: sc,
				}
			: {
					imports,
				}
	);
};

const perfPage = (
	n: number,
	scopes = 0
) => `<!doctype html><html><head><script type="importmap">${bigMap(n, scopes)}</script></head><body>
<script type="module">
runTest(async () => {
  await import("./m.js");
  const N = 200;
  let t = performance.now();
  for (let i = 0; i < N; i++) await import("./m.js");
  const per = (performance.now() - t) / N;
  fail("perf n=${n} scopes=${scopes}: " + per.toFixed(3) + " ms per import() of a cached module");
}, false);
</script></body></html>`;

const perfTests = [100, 1000, 3000]
	.flatMap((n) => [
		site(
			"rv16-perf-importmap-" + n,
			{
				"/": perfPage(n),
				"/m.js": "export default 1;",
			},
			{
				scramjetOnly: true,
			}
		),
	])
	.concat([
		site(
			"rv16-perf-importmap-scoped-500x50",
			{
				"/": perfPage(500, 50),
				"/m.js": "export default 1;",
			},
			{
				scramjetOnly: true,
			}
		),
	]);

const domPage = (n: number) => `<!doctype html><html><head></head><body>
<script type="module">
runTest(async () => {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < ${n}; i++) { const d = document.createElement("div"); d.className = "x" + (i % 7); frag.appendChild(d); }
  document.body.appendChild(frag);
  await import("./m.js");
  const N = 200;
  let t = performance.now();
  for (let i = 0; i < N; i++) await import("./m.js");
  const per = (performance.now() - t) / N;
  fail("perf nomap dom=${n}: " + per.toFixed(3) + " ms per import() of a cached module");
}, false);
</script></body></html>`;
perfTests.push(
	site(
		"rv16-perf-nomap-dom-50000",
		{
			"/": domPage(50000),
			"/m.js": "export default 1;",
		},
		{
			scramjetOnly: true,
		}
	)
);

export default perfTests;

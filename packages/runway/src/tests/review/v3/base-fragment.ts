import { serverTest } from "../../../testcommon.ts";

// a page whose <base> names its own URL: an in-page anchor scrolls, it does not
// reload. Absolute and relative bases, top level and in a frame
const page = (
	base: string
) => `<!doctype html><html><head><base href="${base}"></head><body>
<a id=l href="#sec">go</a><div style="height:3000px"></div><p id=sec>sec</p>
<script>
if (!sessionStorage.loads) sessionStorage.loads = 0;
sessionStorage.loads = +sessionStorage.loads + 1;
</script></body></html>`;

const make = (name: string, base: (port: number) => string, framed: boolean) =>
	serverTest({
		name,
		start: async (server, port) => {
			server.on("request", (req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				if (req.url!.startsWith("/page")) {
					res.end(page(base(port)));
					return;
				}
				res.end(`<!doctype html>${framed ? `<iframe id=f src="/page?x=1" style="width:400px;height:400px"></iframe>` : ""}
<script>
runTest(async () => {
	${framed ? "" : `const f = document.createElement("iframe"); f.src = "/page?x=1"; document.body.append(f);`}
	await new Promise((r) => f.addEventListener("load", r, { once: true }));
	const w = f.contentWindow;
	w.document.getElementById("l").click();
	await new Promise((r) => setTimeout(r, 500));
	let after;
	try { after = [w.sessionStorage.loads, w.location.hash]; } catch (e) { after = "threw:" + e.name; }
	assertConsistent("after", after);
}, true);
</script>`);
			});
		},
	});

export default [
	make(
		"v3-base-self-fragment-abs",
		(port) => `http://localhost:${port}/page?x=1`,
		true
	),
	make("v3-base-self-fragment-rel", () => `/page?x=1`, true),
];

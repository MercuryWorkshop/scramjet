import { serverTest, htmlTest } from "../../../testcommon.ts";

// Rules that depend on another attribute (script src on `type`, link href on
// `rel`) read it once, when the URL is written. What happens when the page
// sets them in the other order? Plus selectors whose rewritten form might not
// parse where the original does.

const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));`;

const ORDERS: Record<string, string> = {
	"type-then-src": `s.type = "module"; s.src = "/m.js?o=1";`,
	"src-then-type": `s.src = "/m.js?o=2"; s.type = "module";`,
	"setattr-src-then-type": `s.setAttribute("src", "/m.js?o=3"); s.setAttribute("type", "module");`,
	"src-then-type-module-upper": `s.src = "/m.js?o=4"; s.setAttribute("type", "MODULE");`,
	"module-then-classic": `s.type = "module"; s.src = "/c.js?o=5"; s.type = "text/javascript";`,
};

export default [
	(() => {
		const t = serverTest({
			name: "rv13-order-script-type",
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					if (u.pathname === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!doctype html><body><script>${T}
window.RES = {};
runTest(async () => {
	for (const [k, js] of Object.entries(${JSON.stringify(ORDERS)})) {
		const s = document.createElement("script");
		s.onerror = () => { window.RES[k] = window.RES[k] || "onerror"; };
		new Function("s", js)(s);
		document.head.append(s);
		await sleep(600);
		assertConsistent(k, String(window.RES[k]));
	}
	// modulepreload decided by rel
	const l = document.createElement("link");
	l.href = "/m.js?o=pre"; l.rel = "modulepreload"; document.head.append(l);
	await sleep(500);
	assertConsistent("modulepreload rel after href", T(() => [l.getAttribute("href"), new URL(l.href).pathname].join(" ")));
}, true);
</script></body>`);
					} else if (u.pathname === "/m.js") {
						res.writeHead(200, {
							"Content-Type": "text/javascript",
						});
						res.end(
							`import { v } from "/dep.js"; window.RES[${JSON.stringify("")} + (${JSON.stringify(Object.fromEntries(Object.keys(ORDERS).map((k, i) => [String(i + 1), k])))})[new URL(import.meta.url).searchParams.get("o")] ] = "module ran " + v;`
						);
					} else if (u.pathname === "/dep.js") {
						res.writeHead(200, {
							"Content-Type": "text/javascript",
						});
						res.end(`export const v = "dep";`);
					} else if (u.pathname === "/c.js") {
						res.writeHead(200, {
							"Content-Type": "text/javascript",
						});
						res.end(
							`window.RES["module-then-classic"] = "classic ran " + (typeof document.currentScript);`
						);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
			},
		});
		t.timeoutMs = 60000;
		return t;
	})(),

	htmlTest({
		name: "rv13-order-selector-contexts",
		html: `<!doctype html><body><div id=h><a href="/x">x</a></div><script>${T}
runTest(async () => {
	const h = document.getElementById("h");
	const sr = h.attachShadow({ mode: "open" }); sr.innerHTML = "<slot></slot>";
	for (const s of ["::slotted([href])", "slot::slotted([href])", ":host([href])", ":host-context([href])", "a::before", "[href]::after", "::part(x)", ":has(:has([href]))", ":is(::before, [href])", ":nth-last-of-type(1 of [href])", ":not(:has([href]))", "a:is([href]):where([href])", ":lang(en)[href]", ":state(x)[href]", ":dir(ltr)[href]", "a[href]:-webkit-any-link", "a[href]:any-link", "[href]:visited", ":popover-open[href]", "[href]:focus-visible", ":has(> [href]) , [href]"]) {
		assertConsistent("doc " + s, T(() => document.querySelectorAll(s).length));
		assertConsistent("shadow " + s, T(() => sr.querySelectorAll(s).length));
		assertConsistent("matches " + s, T(() => h.firstChild.matches(s)));
	}
}, true);
</script></body>`,
	}),
];

import http from "http";
import type { AddressInfo } from "node:net";
import { serverTest, basicTest, type Test } from "../../../testcommon.ts";

// a second origin, served from inside start()
function withSecond(
	name: string,
	js: string,
	secondFiles: (mainPort: number) => Record<string, [string, string]>
) {
	let second: http.Server;
	const test = serverTest({
		name,
		autoPass: true,
		js,
		start: async (server, port) => {
			second = http.createServer((req, res) => {
				const f = secondFiles(port)[(req.url || "/").split("?")[0]];
				if (!f) {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"Content-Type": f[0],
				});
				res.end(f[1]);
			});
			await new Promise<void>((r) => second.listen(0, () => r()));
			const sp = (second.address() as AddressInfo).port;
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				if (req.url === "/second-port") {
					res.writeHead(200);
					res.end(String(sp));
				} else if (req.url === "/gc") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end("<script>top.postMessage('gc', '*')</script>");
				}
			});
		},
	});
	const stop = test.stop;
	test.stop = async () => {
		second.close();
		await stop();
	};
	test.timeoutMs = 15000;
	return test;
}

const H = "text/html";
const J = "application/javascript";

export default [
	withSecond(
		"rv6-pmm-popup-opener",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		let w;
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		w = window.open(SECOND + "/popup", "rv6popup", "width=300,height=300");
		assert(w, "popup opened");
		const e = await p;
		assertEqual(e.origin, SECOND, "origin");
		assert(e.source === w, "source === popup");
		assertEqual(e.data.token, "abc");
		const p2 = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		w.postMessage({ ack: 1 }, SECOND);
		const e2 = await p2;
		assertEqual(e2.data, "ack-ok:" + location.origin);
		w.close();
	`,
		(mp) => ({
			"/popup": [H, `<!doctype html><script src="/popup.js"></script>`],
			"/popup.js": [
				J,
				`
			addEventListener("message", (e) => { opener.postMessage("ack-ok:" + e.origin, e.origin); });
			opener.postMessage({ token: "abc" }, "http://localhost:${mp}");
		`,
			],
		})
	),
	withSecond(
		"rv6-pmm-srcdoc-child",
		`
		const f = document.createElement("iframe");
		f.srcdoc = "<script>parent.postMessage({o: location.origin, h: location.href}, '*')<\/script>";
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		document.body.appendChild(f);
		const e = await p;
		assertEqual(e.origin, location.origin, "srcdoc origin inherits");
		assert(e.source === f.contentWindow, "source");
		assertEqual(e.data.h, "about:srcdoc");
	`,
		() => ({})
	),
	withSecond(
		"rv6-pmm-blank-child-written",
		`
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		f.contentDocument.open();
		f.contentDocument.write("<script>parent.postMessage('w', '*')<\/script>");
		f.contentDocument.close();
		const e = await p;
		assertEqual(e.origin, location.origin, "about:blank origin");
		assert(e.source === f.contentWindow, "source");
	`,
		() => ({})
	),
	withSecond(
		"rv6-pmm-blank-child-eval",
		`
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		f.contentWindow.eval("parent.postMessage('e', '*')");
		const e = await p;
		assertEqual(e.origin, location.origin, "about:blank origin");
		assert(e.source === f.contentWindow, "source");
	`,
		() => ({})
	),
	withSecond(
		"rv6-pmm-blank-child-fn",
		`
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		const fn = new f.contentWindow.Function("parent.postMessage('fn', '*')");
		fn();
		const e = await p;
		assertEqual(e.origin, location.origin, "about:blank origin");
		assert(e.source === f.contentWindow, "source is the iframe (its Function realm)");
	`,
		() => ({})
	),
	withSecond(
		"rv6-pmm-cross-child-blob-script",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		document.body.appendChild(f);
		const e = await p;
		assertEqual(e.origin, SECOND, "origin from blob script");
		assert(e.source === f.contentWindow, "source");
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`const s = document.createElement("script"); s.src = URL.createObjectURL(new Blob(["parent.postMessage('blob', '*')"], {type: "text/javascript"})); document.body.appendChild(s);`,
			],
		})
	),
	withSecond(
		"rv6-pmm-cross-child-data-script",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		document.body.appendChild(f);
		const e = await p;
		assertEqual(e.origin, SECOND, "origin from data: script");
		assert(e.source === f.contentWindow, "source");
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script src="data:text/javascript,parent.postMessage('data', '*')"></script></body>`,
			],
		})
	),
	withSecond(
		"rv6-pmm-cross-child-module",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const got = [];
		const p = new Promise((res) => addEventListener("message", (e) => { got.push(e); if (got.length === 3) res(); }));
		document.body.appendChild(f);
		await p;
		for (const e of got) { assertEqual(e.origin, SECOND, "origin " + e.data); assert(e.source === f.contentWindow, "source " + e.data); }
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script type="module" src="/m.js"></script><script type="module">parent.postMessage("inline-module", "*"); import("/d.js");</script></body>`,
			],
			"/m.js": [J, `parent.postMessage("module", "*");`],
			"/d.js": [J, `parent.postMessage("dynamic", "*");`],
		})
	),
	withSecond(
		"rv6-pmm-cross-parent-calls-child-fn",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const p = new Promise((res) => addEventListener("message", (e) => { if (e.data === "ready") { res(); } }));
		document.body.appendChild(f);
		await p;
		// child listens and posts from a listener invoked by the host (click)
		const p2 = new Promise((res) => addEventListener("message", (e) => { if (e.data === "clicked") res(e); }));
		f.contentWindow.postMessage("click-yourself", "*");
		const e = await p2;
		assertEqual(e.origin, SECOND, "origin from host-invoked listener");
		assert(e.source === f.contentWindow);
		const p3 = new Promise((res) => addEventListener("message", (e) => { if (e.data === "timer") res(e); }));
		f.contentWindow.postMessage("timer", "*");
		const e3 = await p3;
		assertEqual(e3.origin, SECOND, "origin from timer/rAF callback");
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><button id=b>b</button><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`
			b.addEventListener("click", () => parent.postMessage("clicked", "*"));
			addEventListener("message", (e) => {
				if (e.data === "click-yourself") b.click();
				if (e.data === "timer") requestAnimationFrame(() => setTimeout(() => queueMicrotask(() => parent.postMessage("timer", "*"))));
			});
			parent.postMessage("ready", "*");
		`,
			],
		})
	),
	withSecond(
		"rv6-pmm-nested-grandchild-to-top",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		document.body.appendChild(f);
		const e = await p;
		assertEqual(e.origin, location.origin, "grandchild (same as top) origin");
		assert(e.source === f.contentWindow.frames[0], "source is grandchild");
	`,
		(mp) => ({
			"/child": [
				H,
				`<!doctype html><body><iframe src="http://localhost:${mp}/gc"></iframe></body>`,
			],
		})
	),
	withSecond(
		"rv6-pmm-shared-cdn-lib",
		`
		const sp = await (await fetch("/second-port")).text();
		const SECOND = "http://localhost:" + sp;
		await new Promise((r) => { const s = document.createElement("script"); s.src = SECOND + "/lib.js"; s.onload = r; document.head.appendChild(s); });
		const f = document.createElement("iframe"); f.src = SECOND + "/child";
		const ready = new Promise((res) => addEventListener("message", (e) => { if (e.data === "ready") res(); }));
		document.body.appendChild(f);
		await ready;
		// child also loaded /lib.js (same URL); now parent uses its own copy
		const p = new Promise((res) => addEventListener("message", (e) => { if (e.data && e.data.echo) res(e.data); }));
		rv6send(f.contentWindow, "from-parent");
		const d = await p;
		assertEqual(d.origin, location.origin, "child saw parent's origin");
		assertEqual(d.src, true, "child saw parent as source");
	`,
		() => ({
			"/lib.js": [J, `function rv6send(w, m) { w.postMessage(m, "*"); }`],
			"/child": [
				H,
				`<!doctype html><body><script src="/lib.js"></script><script src="/child.js"></script></body>`,
			],
			"/child.js": [
				J,
				`addEventListener("message", (e) => { if (e.data === "from-parent") rv6send(parent, { echo: 1, origin: e.origin, src: e.source === parent }); }); rv6send(parent, "ready");`,
			],
		})
	),
] as Test[];

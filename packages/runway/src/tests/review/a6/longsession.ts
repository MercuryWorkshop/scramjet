import { basicTest, type Test } from "../../../testcommon.ts";
const t = (name: string, js: string) =>
	Object.assign(
		basicTest({
			name: "rv6-ls-" + name,
			js,
		}),
		{
			timeoutMs: 20000,
		}
	);
export default [
	t(
		"docopen-partial-write-reset",
		`
		const f = document.createElement("iframe"); document.body.appendChild(f);
		const d = f.contentDocument;
		d.open(); d.write('<div title="unterminated'); d.close();
		d.open(); d.write('<p id="x">hi</p>'); d.close();
		assert(d.getElementById("x"), "second document.open starts fresh: " + d.body.innerHTML);
		d.open(); d.write('<scr'); d.write('ipt>parent.__w = location.href<\/script>'); d.close();
		assertEqual(window.__w, location.href, "split script after reopen runs with proxied location");
	`
	),
	t(
		"docopen-self-after-load",
		`
		await new Promise((r) => setTimeout(r, 50));
		const f = document.createElement("iframe");
		f.src = location.href.replace(/[^/]*$/, "") + "nothing";
		document.body.appendChild(f);
		await new Promise((r) => (f.onload = r));
		const w = f.contentWindow;
		w.eval('document.open(); document.write("<script>parent.__r = [location.href, typeof fetch, document.URL]<\\/script>"); document.close();');
		await new Promise((r) => setTimeout(r, 100));
		assert(window.__r, "script ran");
		assert(!window.__r[0].includes("/~/"), "location stays proxied after document.open: " + window.__r[0]);
		assert(!window.__r[2].includes("/~/"), "document.URL: " + window.__r[2]);
		const r = await w.fetch("/nothing2").then((x) => x.status, (e) => "err " + e);
		assertEqual(r, 404, "fetch still rewritten after document.open");
	`
	),
	t(
		"many-frames-then-postmessage",
		`
		for (let i = 0; i < 150; i++) { const f = document.createElement("iframe"); document.body.appendChild(f); void f.contentWindow.document; f.remove(); }
		const f = document.createElement("iframe"); f.srcdoc = "<script>parent.postMessage('late', '*')<\/script>";
		const p = new Promise((r) => addEventListener("message", (e) => r([e.data, e.origin, e.source === f.contentWindow]), { once: true }));
		document.body.appendChild(f);
		const r = await p;
		assertEqual(r.join(","), "late," + location.origin + ",true");
		const s = performance.now();
		for (let i = 0; i < 2000; i++) { const a = document.createElement("a"); a.href = "/x" + i; void a.href; }
		const dt = performance.now() - s;
		assert(dt < 2000, "attribute ops after 150 frames took " + dt);
	`
	),
	t(
		"iframe-init-cost",
		`
		const times = [];
		for (let i = 0; i < 60; i++) { const s = performance.now(); const f = document.createElement("iframe"); document.body.appendChild(f); void f.contentWindow.document; times.push(performance.now() - s); f.remove(); }
		const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
		throw new Error("RESULT first10med=" + med(times.slice(0, 10)).toFixed(1) + "ms last10med=" + med(times.slice(-10)).toFixed(1) + "ms");
	`
	),
	t(
		"worker-init-cost",
		`
		const times = [];
		for (let i = 0; i < 15; i++) {
			const u = URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" }));
			const s = performance.now();
			const w = new Worker(u);
			await new Promise((r) => (w.onmessage = r));
			times.push(performance.now() - s); w.terminate();
		}
		const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
		throw new Error("RESULT worker-first-message-median=" + med(times).toFixed(1) + "ms");
	`
	),
] as Test[];

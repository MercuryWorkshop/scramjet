import http from "http";
import { playwrightTest, type Test } from "../../../testcommon.ts";

// Scenario code is served as a real page script so it is rewritten like site code.
const SCEN = String.raw`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onceMsg = () => new Promise((r) => addEventListener("message", r, { once: true }));
let seq = 0;
window.__scen = {
	async iframes(n) {
		for (let i = 0; i < n; i++) {
			const k = i % 3;
			const f = document.createElement("iframe");
			if (k === 0) {
				document.body.appendChild(f);
				f.contentWindow.document.body.innerHTML = "<p>x" + i + "</p>";
				f.contentWindow.foo = { big: new Array(1000).fill(i) };
			} else {
				const loaded = new Promise((r) => (f.onload = r));
				if (k === 1) f.srcdoc = "<p>s" + i + "</p><script>window.foo = new Array(1000).fill(1)<\/script>";
				else f.src = "/blank.html?" + i;
				document.body.appendChild(f);
				await loaded;
				void f.contentWindow.document.title;
			}
			f.remove();
		}
	},
	async evals(n) {
		for (let i = 0; i < n; i++) {
			const u = seq++;
			eval("var __e" + (u % 10) + " = " + u + ";");
			new Function("a", "return a + " + u)(1);
			if (i % 20 === 0) setTimeout("window.__t = " + u, 0);
		}
		await sleep(50);
	},
	async dom(n) {
		const root = document.body;
		for (let i = 0; i < n; i++) {
			const d = document.createElement("div");
			const f = () => {};
			d.addEventListener("click", f);
			d.addEventListener("mousemove", { handleEvent() {} }, { passive: true });
			d.onclick = () => {};
			d.setAttribute("data-i", String(i));
			const a = document.createElement("a"); a.href = "/p" + i; d.appendChild(a);
			root.appendChild(d);
			d.remove();
		}
	},
	async events(n) {
		const el = document.createElement("div");
		let c = 0;
		const h = () => c++;
		addEventListener("message", h);
		el.addEventListener("rv6syn", h);
		for (let i = 0; i < n; i++) {
			postMessage({ i }, "*");
			el.dispatchEvent(new CustomEvent("rv6syn", { detail: i }));
			if (i % 500 === 499) await sleep(0);
		}
		await sleep(20);
		for (let i = 0; i < n / 50; i++) { location.hash = "#h" + (seq++); await new Promise((r) => addEventListener("hashchange", r, { once: true })); }
		const fr = window.__sframe;
		for (let i = 0; i < n / 50; i++) {
			const p = new Promise((r) => fr.contentWindow.addEventListener("storage", r, { once: true }));
			localStorage.setItem("rv6mem", String(seq++));
			await p;
		}
		removeEventListener("message", h);
	},
	async workers(n) {
		for (let i = 0; i < n; i++) {
			const u = URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" }));
			const w = new Worker(u);
			if (i % 10 === 0) await new Promise((r) => (w.onmessage = r));
			w.terminate();
			URL.revokeObjectURL(u);
			const b = URL.createObjectURL(new Blob(["x" + i]));
			URL.revokeObjectURL(b);
		}
	},
	async innerhtml(n) {
		const d = document.createElement("div");
		document.body.appendChild(d);
		for (let i = 0; i < n; i++) {
			d.innerHTML = '<a href="/l' + i + '">l</a><img src="/i' + i + '.png"><style>.c' + i + '{background:url(/b' + i + '.png)}</style><script>window.__x' + (i % 5) + '=' + i + '<\/script><div style="color:red" onclick="void ' + i + '">t</div>';
			void d.innerHTML;
		}
		d.remove();
	},
	async spa(n) {
		const app = document.createElement("div");
		document.body.appendChild(app);
		for (let i = 0; i < n; i++) {
			history.pushState({ i }, "", "/route/" + i);
			app.innerHTML = "";
			for (let j = 0; j < 20; j++) {
				const e = document.createElement("button");
				e.textContent = "b" + j;
				e.addEventListener("click", () => {});
				app.appendChild(e);
			}
			if (i % 50 === 0) { history.back(); await new Promise((r) => addEventListener("popstate", r, { once: true })); }
		}
		app.remove();
	},
};
(async () => {
	const f = document.createElement("iframe");
	f.src = "/blank.html?storage";
	await new Promise((r) => { f.onload = r; document.body.appendChild(f); });
	window.__sframe = f;
	window.__ready = true;
})();
`;

const SCEN_NAMES: Record<string, [number, number]> = {
	// name: [iterations per round, rounds]
	iframes: [60, 3],
	evals: [5000, 3],
	dom: [25000, 3],
	events: [10000, 3],
	workers: [300, 3],
	innerhtml: [3000, 3],
	spa: [500, 3],
};

import { openSync, writeSync, closeSync } from "fs";
export default [
	playwrightTest({
		name: "rv6-memsnap",
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = (req.url || "/").split("?")[0];
				if (p === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><body><script src="/scen.js"></script></body>`
					);
					return;
				}
				if (p === "/scen.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(SCEN);
					return;
				}
				if (p === "/blank.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><p>blank</p>`);
					return;
				}
				res.writeHead(404);
				res.end();
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const cdp = await page.context().newCDPSession(page);
			await cdp.send("HeapProfiler.enable");
			await navigate(`http://localhost:${port}/?snap`);
			let frame;
			for (let t = 0; t < 100 && !frame; t++) {
				const f = page.frames().find((f) => f.url().includes("%3Fsnap"));
				if (
					f &&
					(await f.evaluate(() => (window as any).__ready).catch(() => false))
				)
					frame = f;
				else await page.waitForTimeout(100);
			}
			if (!frame) throw new Error("no frame");
			await frame.evaluate(
				(n) => (window as any).__scen.iframes(n),
				Number(process.env.RV6_SNAP_N || 30)
			);
			for (let i = 0; i < 4; i++) {
				await cdp.send("HeapProfiler.collectGarbage");
				await page.waitForTimeout(150);
			}
			const out = openSync(
				process.env.RV6_SNAP_OUT ||
					"/home/velzie/.cache/sjreview/scratch-a6/snap.heapsnapshot",
				"w"
			);
			cdp.on("HeapProfiler.addHeapSnapshotChunk", (e: any) =>
				writeSync(out, e.chunk)
			);
			await cdp.send("HeapProfiler.takeHeapSnapshot", {
				reportProgress: false,
			});
			closeSync(out);
			server.close();
		},
	}),
	playwrightTest({
		name: "rv6-mem-all",
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p.startsWith("/route")) {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><body><script src="/scen.js"></script></body>`
					);
					return;
				}
				if (p === "/scen.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(SCEN);
					return;
				}
				if (p === "/blank.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><p>blank</p><script>window.foo = new Array(1000).fill(2)</script>`
					);
					return;
				}
				res.writeHead(404);
				res.end();
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const cdp = await page.context().newCDPSession(page);
			await cdp.send("HeapProfiler.enable");
			const gc = async () => {
				for (let i = 0; i < 4; i++) {
					await cdp.send("HeapProfiler.collectGarbage");
					await page.waitForTimeout(150);
				}
				return (await cdp.send("Runtime.getHeapUsage")).usedSize as number;
			};
			const only = process.env.RV6_SCEN
				? process.env.RV6_SCEN.split(",")
				: Object.keys(SCEN_NAMES);
			const lines: string[] = [];
			try {
				for (const name of only) {
					await navigate(`http://localhost:${port}/?${name}`);
					let frame;
					for (let t = 0; t < 100; t++) {
						frame = page
							.frames()
							.find(
								(f) =>
									f.url().includes(String(port)) &&
									(f.url().includes("%3F" + name) ||
										f.url().includes("?" + name)) &&
									!f.url().includes("blank.html")
							);
						if (
							frame &&
							(await frame
								.evaluate(() => (window as any).__ready)
								.catch(() => false))
						)
							break;
						frame = undefined;
						await page.waitForTimeout(100);
					}
					if (!frame) throw new Error("frame not ready for " + name);
					page.on("framenavigated", (f) => {
						if (f === frame)
							lines.push("NAV " + name + " " + f.url().slice(0, 200));
					});
					lines.push("frame " + frame.url().slice(0, 200));
					const [iters, rounds] = SCEN_NAMES[name];
					// warm-up round, then measured rounds
					await frame.evaluate(([n, k]) => (window as any).__scen[k](n), [
						Math.ceil(iters / 5),
						name,
					] as any);
					const base = await gc();
					const sizes = [base];
					const t0 = Date.now();
					for (let r = 0; r < rounds; r++) {
						await frame.evaluate(([n, k]) => (window as any).__scen[k](n), [
							iters,
							name,
						] as any);
						sizes.push(await gc());
					}
					const dt = Date.now() - t0;
					const growth = (sizes[sizes.length - 1] - base) / (iters * rounds);
					lines.push(
						`${name}: iters/round=${iters} heapMB=[${sizes.map((s) => (s / 1e6).toFixed(1)).join(", ")}] bytes/iter=${growth.toFixed(0)} time=${dt}ms`
					);
				}
			} catch (e) {
				lines.push("ERR " + e);
			} finally {
				server.close();
			}
			throw new Error("RV6MEM\n" + lines.join("\n"));
		},
	}),
] as Test[];

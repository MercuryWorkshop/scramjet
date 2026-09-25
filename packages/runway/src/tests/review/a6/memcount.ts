import http from "http";
import { playwrightTest, type Test } from "../../../testcommon.ts";
export default [
	playwrightTest({
		name: "rv6-memprof",
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(
					`<!doctype html><body><script>window.__ready = 1</script></body>`
				);
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const cdp = await page.context().newCDPSession(page);
			await navigate(`http://localhost:${port}/?cnt`);
			let frame;
			for (let t = 0; t < 100 && !frame; t++) {
				const f = page.frames().find((f) => f.url().includes("%3Fcnt"));
				if (
					f &&
					(await f.evaluate(() => (window as any).__ready).catch(() => 0))
				)
					frame = f;
				else await page.waitForTimeout(100);
			}
			await cdp.send("Profiler.enable");
			await cdp.send("Profiler.setSamplingInterval", {
				interval: 100,
			});
			await cdp.send("Profiler.start");
			await frame!.evaluate(() => {
				for (let i = 0; i < 30; i++) {
					const f = document.createElement("iframe");
					document.body.appendChild(f);
					void f.contentWindow!.document;
					f.remove();
				}
			});
			const { profile } = (await cdp.send("Profiler.stop")) as any;
			const self = new Map<string, number>();
			const dt = profile.timeDeltas;
			const byId = new Map(profile.nodes.map((n: any) => [n.id, n]));
			const counts = new Map<number, number>();
			for (const s of profile.samples) counts.set(s, (counts.get(s) || 0) + 1);
			// inclusive: walk parents
			const parent = new Map<number, number>();
			for (const n of profile.nodes)
				for (const c of n.children || []) parent.set(c, n.id);
			const incl = new Map<string, number>();
			for (const [id, c] of counts) {
				const n: any = byId.get(id);
				const k =
					n.callFrame.functionName +
					"@" +
					n.callFrame.lineNumber +
					":" +
					n.callFrame.columnNumber;
				self.set(k, (self.get(k) || 0) + c);
				const seen = new Set<string>();
				let cur: any = id;
				while (cur !== undefined) {
					const m: any = byId.get(cur);
					const kk =
						(m.callFrame.functionName || "(anon)") +
						"@" +
						m.callFrame.url.split("/").pop() +
						":" +
						m.callFrame.lineNumber +
						":" +
						m.callFrame.columnNumber;
					if (!seen.has(kk)) {
						seen.add(kk);
						incl.set(kk, (incl.get(kk) || 0) + c);
					}
					cur = parent.get(cur);
				}
			}
			const total = profile.samples.length;
			const top = (m: Map<string, number>) =>
				[...m]
					.sort((a, b) => b[1] - a[1])
					.slice(0, 25)
					.map(([k, v]) => ((100 * v) / total).toFixed(1) + "% " + k)
					.join("\n");
			server.close();
			throw new Error(
				"RV6PROF total=" +
					total +
					"\nSELF\n" +
					top(self) +
					"\nINCL\n" +
					top(incl)
			);
		},
	}),
	playwrightTest({
		name: "rv6-memcount",
		fn: async ({ page, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(
					`<!doctype html><body><script>window.__ready = 1</script></body>`
				);
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as any).port;
			const cdp = await page.context().newCDPSession(page);
			await navigate(`http://localhost:${port}/?cnt`);
			let frame;
			for (let t = 0; t < 100 && !frame; t++) {
				const f = page.frames().find((f) => f.url().includes("%3Fcnt"));
				if (
					f &&
					(await f.evaluate(() => (window as any).__ready).catch(() => 0))
				)
					frame = f;
				else await page.waitForTimeout(100);
			}
			const r = await frame!.evaluate(() => {
				const c: any = (window as any)[Symbol.for("scramjet client global")];
				const out: any = {};
				if (c.nativeStore) {
					let d = 0;
					for (const [k, v] of c.nativeStore)
						d += Object.getOwnPropertyNames(v).length;
					out.nativeStoreInterfaces = c.nativeStore.size;
					out.nativeStoreDescriptors = d;
				}
				const box = c.box;
				out.ctorsNames = Object.keys(box.ctors).length;
				out.ctorsEntries = Object.values(box.ctors).reduce(
					(a: number, b: any) => a + b.length,
					0
				);
				out.clients = box.clients.length;
				return out;
			});
			const measure = async () => {
				for (let i = 0; i < 3; i++)
					await cdp.send("HeapProfiler.collectGarbage");
				return (await cdp.send("Runtime.getHeapUsage")).usedSize;
			};
			const before = await measure();
			await frame!.evaluate(async () => {
				for (let i = 0; i < 20; i++) {
					const f = document.createElement("iframe");
					document.body.appendChild(f);
					void f.contentWindow!.document;
					f.remove();
				}
			});
			const after = await measure();
			r.perAboutBlankIframeKB = Math.round((after - before) / 20 / 1024);
			const t0 = await frame!.evaluate(() => {
				const d = document.createElement("div");
				const s = performance.now();
				for (let i = 0; i < 20000; i++) d.innerHTML = "<b>x</b>";
				return performance.now() - s;
			});
			await frame!.evaluate(async () => {
				for (let i = 0; i < 200; i++) {
					const f = document.createElement("iframe");
					document.body.appendChild(f);
					void f.contentWindow!.document;
					f.remove();
				}
			});
			const t1 = await frame!.evaluate(() => {
				const d = document.createElement("div");
				const s = performance.now();
				for (let i = 0; i < 20000; i++) d.innerHTML = "<b>x</b>";
				return performance.now() - s;
			});
			r.innerHTML20k_before_ms = Math.round(t0);
			r.innerHTML20k_after220frames_ms = Math.round(t1);
			r.clientsAfter = await frame!.evaluate(
				() =>
					(window as any)[Symbol.for("scramjet client global")].box.clients
						.length
			);
			const ev = await frame!.evaluate(() => {
				const box: any = (window as any)[Symbol.for("scramjet client global")]
					.box;
				const k = (o: any) => (o ? Object.keys(o).length : -1);
				const b = {
					sm: k(box.sourcemaps),
					sr: k(box.scriptrealms),
					sh: k(box.scripthashes),
				};
				for (let i = 0; i < 2000; i++) {
					(0, eval)("1+" + i);
					new Function("return " + i);
				}
				return [
					b,
					{
						sm: k(box.sourcemaps),
						sr: k(box.scriptrealms),
						sh: k(box.scripthashes),
					},
				];
			});
			r.evalRegistries = ev;
			server.close();
			throw new Error("RV6CNT " + JSON.stringify(r));
		},
	}),
] as Test[];

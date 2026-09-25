import { serverTest } from "../../../testcommon.ts";

// rv19: storage APIs with no scoping at all. Another proxied site is simulated
// by a cross-origin iframe (127.0.0.1 vs localhost).

export default [
	serverTest({
		name: "rv19-misc-unscoped-apis",
		autoPass: true,
		js: `
			const XO = "http://127.0.0.1:" + location.port;
			const out = {};
			// the "other site" writes first
			const f = document.createElement("iframe"); f.src = XO + "/other.html"; document.body.appendChild(f);
			await new Promise((r) => { addEventListener("message", (e) => { if (e.data === "other-done") r(); }); setTimeout(r, 4000); });
			try { out.locksSeen = (await navigator.locks.query()).held.map((l) => l.name).filter((n) => n.startsWith("other-")); } catch (e) { out.locksSeen = "ERR:" + e.name; }
			try { out.lockContended = await navigator.locks.request("other-session-lock", { ifAvailable: true }, (l) => l === null ? "blocked-by-other-site" : "acquired"); } catch (e) { out.lockContended = "ERR:" + e.name; }
			try { const b = navigator.storageBuckets; out.buckets = b ? (await b.keys()).filter((n) => n.startsWith("other")) : "noapi"; } catch (e) { out.buckets = "ERR:" + e.name; }
			try { if (navigator.storageBuckets) { const bk = await navigator.storageBuckets.open("otherbucket"); const root = await bk.getDirectory(); const n = []; for await (const [k] of root.entries()) n.push(k); out.bucketOpfs = n; } } catch (e) { out.bucketOpfs = "ERR:" + e.name; }
			try { const e = await navigator.storage.estimate(); out.estimateUsageNonZeroBeforeWriting = e.usage > 0; } catch (e) { out.estimateUsageNonZeroBeforeWriting = "ERR"; }
			try { out.persisted = await navigator.storage.persisted(); } catch (e) { out.persisted = "ERR:" + e.name; }
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
			fail(JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/other.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><script>(async () => {
						navigator.locks.request("other-session-lock", () => new Promise(() => {}));
						try { if (navigator.storageBuckets) { const b = await navigator.storageBuckets.open("otherbucket"); const root = await b.getDirectory(); await root.getFileHandle("other-secret.txt", { create: true }); } } catch (e) {}
						localStorage.setItem("big", "x".repeat(100000));
						await new Promise((r) => setTimeout(r, 300));
						parent.postMessage("other-done", "*");
					})();</script>`);
					return;
				}
			});
		},
	}),
];

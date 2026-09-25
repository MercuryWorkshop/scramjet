import { serverTest } from "../../../testcommon.ts";

// rv19: third-party (cross-site iframe) storage is partitioned by top-level
// site in Chrome. The same origin at top level must not see what it wrote
// while embedded.

export default [
	serverTest({
		name: "rv19-partition-thirdparty-storage",
		autoPass: true,
		js: `
			const XO = "http://127.0.0.1:" + location.port;
			const f = document.createElement("iframe"); f.src = XO + "/embed.html"; document.body.appendChild(f);
			await new Promise((r) => { addEventListener("message", (e) => { if (e.data === "written") r(); }); setTimeout(r, 4000); });
			const res = await new Promise((r) => { addEventListener("message", (e) => { if (e.data && e.data.top) r(e.data); }); window.open(XO + "/top.html", "_blank"); setTimeout(() => r("timeout"), 5000); });
			assertConsistent("thirdparty", res);
			fail(JSON.stringify(res));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/embed.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><script>(async () => {
						localStorage.setItem("tp", "embedded");
						sessionStorage.setItem("tps", "embedded");
						await new Promise((r) => { const q = indexedDB.open("rv19tp"); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => { q.result.close(); r(); }; });
						await (await caches.open("rv19tpc")).put("/x", new Response("x"));
						const bc = new BroadcastChannel("rv19tpbc"); bc.onmessage = (e) => bc.postMessage("embed-heard:" + e.data);
						window.__bc = bc;
						parent.postMessage("written", "*");
					})();</script>`);
					return;
				}
				if (path === "/top.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><script>(async () => {
						const bc = new BroadcastChannel("rv19tpbc"); let heard = null; bc.onmessage = (e) => { heard = e.data; }; bc.postMessage("hi");
						await new Promise((r) => setTimeout(r, 500));
						const idb = (await indexedDB.databases()).map((d) => d.name).filter((n) => n.startsWith("rv19")).join(",");
						const cs = (await caches.keys()).filter((n) => n.startsWith("rv19")).join(",");
						opener.postMessage({ top: true, ls: localStorage.getItem("tp"), idb, cs, bc: heard }, "*");
						close();
					})();</script>`);
					return;
				}
			});
		},
	}),
];

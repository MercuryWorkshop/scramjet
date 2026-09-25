import { serverTest } from "../../../testcommon.ts";

// rv19: a sandboxed (no allow-same-origin) frame has an opaque origin: Chrome
// throws SecurityError on every storage API and self.origin is "null".

const PROBE = `(async () => {
	const r = {};
	const t = async (k, f) => { try { r[k] = await f(); } catch (e) { r[k] = "ERR:" + e.name; } };
	await t("origin", () => self.origin);
	await t("ls", () => localStorage.getItem("authToken"));
	await t("ss", () => sessionStorage.getItem("csrf"));
	await t("idb", async () => (await indexedDB.databases()).map((d) => d.name).join(","));
	await t("caches", async () => (await caches.keys()).join(","));
	await t("write", () => { localStorage.setItem("authToken", "planted"); return "wrote"; });
	parent.postMessage({ sb: true, id: self.ID, r }, "*");
})();`;

export default [
	serverTest({
		name: "rv19-sandbox-srcdoc-storage",
		autoPass: true,
		js: `
			localStorage.setItem("authToken", "secret-jwt");
			sessionStorage.setItem("csrf", "c1");
			await new Promise((res) => { const q = indexedDB.open("appdb"); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => { q.result.close(); res(); }; });
			await caches.open("appcache");
			const src = await (await fetch("/probe.js")).text();
			const got = {};
			addEventListener("message", (e) => { if (e.data && e.data.sb) got[e.data.id] = e.data.r; });
			const mk = (id, attrs) => { const f = document.createElement("iframe"); for (const k in attrs) f.setAttribute(k, attrs[k].replace("%ID%", id)); document.body.appendChild(f); };
			mk("srcdoc", { sandbox: "allow-scripts", srcdoc: "<script>self.ID='%ID%';" + src + "<\\/script>" });
			mk("url", { sandbox: "allow-scripts", src: "/probe.html?%ID%" });
			await new Promise((r) => setTimeout(r, 1500));
			got.parentTokenAfter = localStorage.getItem("authToken");
			for (const k of Object.keys(got)) assertConsistent(k, got[k]);
			fail(JSON.stringify(got));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/probe.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(PROBE);
					return;
				}
				if (path === "/probe.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<script>self.ID="url"</script><script src="/probe.js"></script>`
					);
					return;
				}
			});
		},
	}),
];

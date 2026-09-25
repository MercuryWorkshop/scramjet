import { serverTest } from "../../../testcommon.ts";

// rv20: a SharedWorker keeps working after the tab that created it closes

const SW = String.raw`
const inst = Math.random().toString(36).slice(2);
onconnect = (e) => {
	const p = e.ports[0];
	p.onmessage = async (m) => {
		const g = async (f) => { try { return await Promise.race([f(), new Promise((r) => setTimeout(() => r("timeout"), 3000))]); } catch (err) { return "ERR " + err.name + ": " + err.message; } };
		const out = { inst };
		out.fetch = await g(async () => (await fetch("/data.txt")).text());
		out.idb = await g(() => new Promise((res) => { const q = indexedDB.open("rv20life"); q.onsuccess = () => { res("ok"); q.result.close(); }; q.onerror = () => res("err"); }));
		out.timer = await g(() => new Promise((r) => setTimeout(() => r("fired"), 10)));
		p.postMessage(out);
	};
};`;

const TAB = String.raw`<!doctype html><script>
const sw = new SharedWorker("/life.js", "life");
sw.port.onmessage = (e) => opener.__lifeMsg(e.data);
window.ask = () => sw.port.postMessage(1);
</script>`;

export default [
	serverTest({
		name: "rv20-sharedworker-outlives-creator",
		autoPass: true,
		js: String.raw`
		const msgs = [];
		let wake;
		window.__lifeMsg = (d) => { msgs.push(d); if (wake) wake(); };
		const next = () => new Promise((r) => { wake = r; setTimeout(r, 5000); });
		const url = "/tab.html?same";
		const a = window.open(url, "_blank");
		await new Promise((r) => { const t = setInterval(() => { try { if (a.ask) { clearInterval(t); r(); } } catch {} }, 50); setTimeout(r, 5000); });
		let p = next(); a.ask(); await p;
		const b = window.open(url, "_blank");
		await new Promise((r) => { const t = setInterval(() => { try { if (b.ask) { clearInterval(t); r(); } } catch {} }, 50); setTimeout(r, 5000); });
		a.close();
		await new Promise((r) => setTimeout(r, 500));
		p = next(); b.ask(); await p;
		b.close();
		const out = { first: msgs[0] && { ...msgs[0], inst: "x" }, afterClose: msgs[1] && { ...msgs[1], inst: "x" }, sameInstance: !!(msgs[0] && msgs[1] && msgs[0].inst === msgs[1].inst) };
		assertConsistent("life", out);
		console.log("RV20DUMP life " + JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const p = (req.url || "/").split("?")[0];
				if (p === "/" || p === "/script.js") return;
				if (p === "/life.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript",
					});
					res.end(SW);
					return;
				}
				if (p === "/tab.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(TAB);
					return;
				}
				if (p === "/data.txt") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("data");
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	}),
];

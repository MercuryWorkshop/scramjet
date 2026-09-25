import { serverTest } from "../../../testcommon.ts";

// page -> worker messages: does every kind of worker realm unwrap the
// {$scramjet$messagetype, $scramjet$data} envelope?

const ECHO = `onmessage = (e) => postMessage({ keys: e.data && typeof e.data === "object" ? Object.keys(e.data).join() : typeof e.data, origin: e.origin });`;

function server(s: any) {
	s.on("request", (req: any, res: any) => {
		if (req.url === "/" || req.url === "/script.js") return;
		if (req.url.startsWith("/echo.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(ECHO);
			return;
		}
		if (req.url.startsWith("/nested.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(
				`const w = new Worker("/echo.js"); w.onmessage = (e) => postMessage(e.data); onmessage = (e) => w.postMessage(e.data);`
			);
			return;
		}
		if (req.url.startsWith("/port.js")) {
			res.writeHead(200, {
				"content-type": "text/javascript",
			});
			res.end(
				`onmessage = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ keys: m.data && typeof m.data === "object" ? Object.keys(m.data).join() : typeof m.data }); };`
			);
			return;
		}
		res.writeHead(404);
		res.end("nf");
	});
}

export default [
	serverTest({
		name: "rv17-worker-envelope",
		autoPass: true,
		start: async (s) => server(s),
		js: `
			const K = async (k, f) => {
				let v;
				try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
				if (v === undefined) v = "undefined";
				assertConsistent(k, typeof v === "string" ? v : JSON.stringify(v));
			};
			const ask = (w, msg = { a: 1 }) => new Promise((r) => { w.onmessage = (e) => r(e.data); w.onerror = (e) => r("error " + (e.message || "")); setTimeout(() => r("timeout"), 4000); w.postMessage(msg); });
			const src = ${JSON.stringify(ECHO)};
			await K("url", () => ask(new Worker("/echo.js")));
			await K("module", () => ask(new Worker("/echo.js", { type: "module" })));
			await K("blob", () => ask(new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })))));
			await K("data", () => ask(new Worker("data:text/javascript," + encodeURIComponent(src))));
			await K("nested", () => ask(new Worker("/nested.js")));
			await K("importScripts", () => ask(new Worker(URL.createObjectURL(new Blob(["importScripts(" + JSON.stringify(location.origin + "/echo.js") + ")"], { type: "text/javascript" })))));
			await K("fromBlankChild", () => { const f = document.createElement("iframe"); document.body.append(f); return ask(new f.contentWindow.Worker("/echo.js")); });
			await K("fromSrcdocChild", () => new Promise((r) => { const f = document.createElement("iframe"); window.__wr = r; f.srcdoc = "<script>const w = new Worker(" + JSON.stringify(location.origin + "/echo.js") + "); w.onmessage = e => parent.__wr(e.data); w.postMessage({ a: 1 });<\\/script>"; document.body.append(f); setTimeout(() => r("timeout"), 4000); }));
			await K("portToBlobWorker", async () => { const w = new Worker(URL.createObjectURL(new Blob([await (await fetch("/port.js")).text()], { type: "text/javascript" }))); const mc = new MessageChannel(); w.postMessage(null, [mc.port2]); return await new Promise(r => { mc.port1.onmessage = e => r(e.data); mc.port1.postMessage({ p: 1 }); setTimeout(() => r("timeout"), 4000); }); });
			await K("portToDataWorker", async () => { const w = new Worker("data:text/javascript," + encodeURIComponent(await (await fetch("/port.js")).text())); const mc = new MessageChannel(); w.postMessage(null, [mc.port2]); return await new Promise(r => { mc.port1.onmessage = e => r(e.data); mc.port1.postMessage({ p: 1 }); setTimeout(() => r("timeout"), 4000); }); });
			await K("sharedBlob", () => new Promise((r) => { const sw = new SharedWorker(URL.createObjectURL(new Blob(["onconnect = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ keys: Object.keys(m.data).join() }); };"], { type: "text/javascript" }))); sw.port.onmessage = (e) => r(e.data); sw.port.postMessage({ s: 1 }); setTimeout(() => r("timeout"), 4000); }));
			await K("sharedData", () => new Promise((r) => { const sw = new SharedWorker("data:text/javascript," + encodeURIComponent("onconnect = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ keys: Object.keys(m.data).join() }); };")); sw.port.onmessage = (e) => r(e.data); sw.port.postMessage({ s: 1 }); setTimeout(() => r("timeout"), 4000); }));
		`,
	}),
];

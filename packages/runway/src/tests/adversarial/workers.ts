import { serverTest } from "../../testcommon.ts";

// A worker gets its own scramjet client with iswindow === false, its own
// location, and its own URL base for fetch/XHR/importScripts. Sites lean on
// workers for anything expensive - PDF.js, monaco, wasm runtimes, analytics
// batching - and bundlers emit module workers by default.

const workerTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			const files: Record<string, string> = {
				"/w.js": `
					self.onmessage = (e) => {
						try {
							postMessage({
								kind: "ok",
								got: e.data,
								href: self.location.href,
								pathname: self.location.pathname,
								origin: self.origin,
								isWorkerScope: typeof WorkerGlobalScope !== "undefined",
								hasWindow: typeof window !== "undefined",
								ua: typeof navigator.userAgent,
								dataKeys: Object.keys(e.data && typeof e.data === "object" ? e.data : {}),
							});
						} catch (err) { postMessage({ kind: "err", err: String(err) }); }
					};
				`,
				"/wfetch.js": `
					self.onmessage = async () => {
						try {
							const r = await fetch("/echo");
							const j = await r.json();
							const xhr = new XMLHttpRequest();
							await new Promise((res, rej) => {
								xhr.onload = res; xhr.onerror = rej;
								xhr.open("GET", "/echo"); xhr.send();
							});
							postMessage({ kind: "ok", fetchPath: j.path, respUrl: r.url, xhrUrl: xhr.responseURL, xhrStatus: xhr.status });
						} catch (err) { postMessage({ kind: "err", err: String(err) }); }
					};
				`,
				"/wimport.js": `
					importScripts("/wlib.js");
					self.onmessage = () => postMessage({ kind: "ok", lib: self.libValue ?? null });
				`,
				"/wlib.js": `self.libValue = "fromlib";`,
				"/wmod.js": `self.onmessage = () => postMessage({ kind: "ok", metaUrl: import.meta.url });`,
				"/wmodimport.js": `
					import { v } from "/wmoddep.js";
					self.onmessage = () => postMessage({ kind: "ok", v });
				`,
				"/wmoddep.js": `export const v = "frommodule";`,
				"/wthrow.js": `throw new Error("worker-boom");`,
				"/sharedw.js": `
					self.onconnect = (e) => {
						const p = e.ports[0];
						p.onmessage = () => p.postMessage({ kind: "ok", href: self.location.href });
						if (p.start) p.start();
					};
				`,
			};
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (files[path]) {
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(files[path]);
					return;
				}
				if (path === "/echo") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ path }));
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("nf");
			});
		},
	});

// wait for one message, failing loudly on worker errors
const ASK = `
	const ask = (w, msg) => new Promise((res, rej) => {
		const errors = [];
		w.onerror = (e) => errors.push((e.message || "(no message)") + " @ " + (e.filename || "(no filename)"));
		w.onmessage = (e) => res(e.data);
		setTimeout(() => rej(new Error("worker did not reply; errors=" + JSON.stringify(errors))), 6000);
		w.postMessage(msg ?? "go");
	});
`;

export default [
	workerTest(
		"workers-classic-scope",
		`
			${ASK}
			const w = new Worker("/w.js");
			const d = await ask(w, { hello: "world" });
			assertEqual(d.kind, "ok", "worker ran: " + JSON.stringify(d));
			assertDeepEqual(d.got, { hello: "world" }, "the message arrived unwrapped");
			assertDeepEqual(d.dataKeys, ["hello"], "no proxy wrapper keys in event.data: " + JSON.stringify(d.dataKeys));
			assertEqual(d.href, location.origin + "/w.js", "self.location.href");
			assertEqual(d.pathname, "/w.js", "self.location.pathname");
			assert(!d.href.includes("/~/sj/"), "self.location.href must not expose the proxy URL");
			assertEqual(d.isWorkerScope, true, "WorkerGlobalScope exists");
			assertEqual(d.hasWindow, false, "no window in a worker");
			assertEqual(d.ua, "string", "navigator.userAgent");
			w.terminate();
		`
	),
	workerTest(
		"workers-structured-clone",
		`
			${ASK}
			const w = new Worker("/w.js");
			const d = await ask(w, {
				m: new Map([["k", 1]]),
				s: new Set([1, 2]),
				dt: new Date(0),
				buf: new Uint8Array([1, 2, 3]),
			});
			assertEqual(d.kind, "ok", "ran");
			assertEqual(d.got.m instanceof Map, true, "Map survived");
			assertEqual(d.got.m.get("k"), 1, "Map contents");
			assertEqual(d.got.s instanceof Set, true, "Set survived");
			assertEqual(d.got.dt instanceof Date, true, "Date survived");
			assertEqual(d.got.buf instanceof Uint8Array, true, "typed array survived");
			w.terminate();
		`
	),
	workerTest(
		"workers-fetch-and-xhr-inside",
		`
			${ASK}
			const w = new Worker("/wfetch.js");
			const d = await ask(w);
			assertEqual(d.kind, "ok", "worker ran: " + JSON.stringify(d));
			assertEqual(d.fetchPath, "/echo", "a relative fetch resolves against the worker URL");
			assertEqual(d.respUrl, location.origin + "/echo", "Response.url inside a worker");
			assertEqual(d.xhrUrl, location.origin + "/echo", "xhr.responseURL inside a worker");
			assertEqual(d.xhrStatus, 200, "xhr status");
			w.terminate();
		`
	),
	workerTest(
		"workers-importscripts",
		`
			${ASK}
			const w = new Worker("/wimport.js");
			const d = await ask(w);
			assertEqual(d.kind, "ok", "worker ran: " + JSON.stringify(d));
			assertEqual(d.lib, "fromlib", "importScripts loaded and ran the library");
			w.terminate();
		`
	),
	workerTest(
		"workers-module-without-imports",
		`
			${ASK}
			const w = new Worker("/wmod.js", { type: "module" });
			const d = await ask(w);
			assertEqual(d.kind, "ok", "module worker ran: " + JSON.stringify(d));
			assertEqual(d.metaUrl, location.origin + "/wmod.js", "import.meta.url in a module worker");
			w.terminate();
		`
	),
	workerTest(
		"workers-url-argument",
		`
			${ASK}
			const w = new Worker(new URL("/w.js", location.href));
			const d = await ask(w);
			assertEqual(d.kind, "ok", "new Worker(URL) works");
			assertEqual(d.href, location.origin + "/w.js", "resolved URL");
			w.terminate();
		`
	),
	workerTest(
		"workers-error-event",
		`
			const w = new Worker("/wthrow.js");
			const e = await new Promise((res, rej) => {
				w.onerror = res;
				setTimeout(() => rej(new Error("no error event fired")), 6000);
			});
			assert((e.message || "").includes("worker-boom"), "error message: " + e.message);
			assert(!(e.filename || "").includes("/~/sj/"), "error filename must not expose the proxy URL: " + e.filename);
			assertEqual(e.filename, location.origin + "/wthrow.js", "error filename");
			w.terminate();
		`
	),
	workerTest(
		"workers-terminate",
		`
			${ASK}
			const w = new Worker("/w.js");
			await ask(w);
			w.terminate();
			let replied = false;
			w.onmessage = () => { replied = true; };
			w.postMessage("after-terminate");
			await new Promise((r) => setTimeout(r, 300));
			assertEqual(replied, false, "a terminated worker stops replying");
		`
	),

	// ------------------------------------------------------------------
	workerTest(
		// KNOWN FAILURE: self.origin inside a worker reports the proxy origin
		// rather than the site's. Workers use it for postMessage targetOrigin
		// checks and for building absolute URLs.
		"workers-self-origin",
		`
			${ASK}
			const w = new Worker("/w.js");
			const d = await ask(w);
			assertEqual(d.kind, "ok", "ran");
			assert(!String(d.origin).includes(":4500"), "self.origin must not expose the proxy origin: " + d.origin);
			assertEqual(d.origin, location.origin, "self.origin");
			w.terminate();
		`
	),
	workerTest(
		// KNOWN FAILURE: a module worker that statically imports anything never
		// starts - it dies with an error event whose message and filename are both
		// undefined. Module workers without imports are fine, so this is import
		// resolution inside the module worker. Vite and webpack 5 emit exactly
		// this shape (new Worker(new URL(…), {type:"module"}) importing chunks).
		"workers-module-with-static-import",
		`
			${ASK}
			const w = new Worker("/wmodimport.js", { type: "module" });
			const d = await ask(w);
			assertEqual(d.kind, "ok", "module worker with a static import: " + JSON.stringify(d));
			assertEqual(d.v, "frommodule", "the imported binding");
			w.terminate();
		`
	),
	workerTest(
		"workers-shared-worker",
		`
			if (typeof SharedWorker === "undefined") { pass(); return; }
			const w = new SharedWorker("/sharedw.js");
			w.port.start();
			const d = await new Promise((res, rej) => {
				w.port.onmessage = (e) => res(e.data);
				setTimeout(() => rej(new Error("no reply from the SharedWorker")), 6000);
				w.port.postMessage("go");
			});
			assertEqual(d.kind, "ok", "the SharedWorker replied: " + JSON.stringify(d));
			assertEqual(d.href, location.origin + "/sharedw.js", "self.location.href in a SharedWorker");
		`
	),
];

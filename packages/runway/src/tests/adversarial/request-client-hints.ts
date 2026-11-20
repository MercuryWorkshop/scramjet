import { serverTest } from "../../testcommon.ts";

const json = (res: any, value: unknown) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(value));
};

export default [
	// Critical-CH restarts a navigation, never a subresource: a POST asked
	// for hints is answered, not sent a second time
	serverTest({
		name: "request-critical-ch-post-sent-once",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const r = await fetch("/api?" + id, { method: "POST", body: "hello" });
			assertEqual(await r.text(), "ok");
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(JSON.stringify(seen), JSON.stringify(["hello"]));
		`,
		async start(server) {
			const runs: Record<string, string[]> = {};
			const run = (url: string) => (runs[url.split("?")[1]] ??= []);
			server.on("request", (req, res) => {
				if (req.url!.startsWith("/api?")) {
					let body = "";
					req.on("data", (c) => (body += c));
					req.on("end", () => {
						run(req.url!).push(body);
						res.writeHead(200, {
							"Accept-CH": "Sec-CH-UA-Arch",
							"Critical-CH": "Sec-CH-UA-Arch",
						});
						res.end("ok");
					});
				} else if (req.url!.startsWith("/seen?")) {
					json(res, run(req.url!));
				}
			});
		},
	}),
	// an insecure origin is never sent a high-entropy hint, whatever it asks
	serverTest({
		name: "request-no-client-hints-over-http",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			await fetch("/ask?" + id);
			await fetch("/probe?" + id);
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(seen.arch, null);
		`,
		async start(server) {
			const runs: Record<string, { arch: string | null }> = {};
			const run = (url: string) => (runs[url.split("?")[1]] ??= { arch: null });
			server.on("request", (req, res) => {
				if (req.url!.startsWith("/ask?")) {
					res.writeHead(200, { "Accept-CH": "Sec-CH-UA-Arch" });
					res.end();
				} else if (req.url!.startsWith("/probe?")) {
					run(req.url!).arch =
						(req.headers["sec-ch-ua-arch"] as string | undefined) ?? null;
					res.end();
				} else if (req.url!.startsWith("/seen?")) {
					json(res, run(req.url!));
				}
			});
		},
	}),
	// a top-level navigation answered with Critical-CH is made again with the
	// hint, and with the cookie the dropped response set. Bare headless
	// Chromium does not act on Accept-CH here, so this is the proxy alone
	serverTest({
		name: "request-critical-ch-restarts-navigation",
		hostname: "hints.runway.test",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const popup = window.open("/doc?" + id);
			let seen = [];
			for (let i = 0; i < 100 && seen.length < 2; i++) {
				await new Promise((r) => setTimeout(r, 50));
				seen = await (await fetch("/seen?" + id)).json();
			}
			popup?.close();
			assertEqual(seen.length, 2, "asked twice");
			assertEqual(seen[0].arch, null, "first without the hint");
			assert(seen[1].arch !== null, "second with it");
			assertEqual(seen[1].cookie, "challenge=" + id, "and the cookie the first set");
		`,
		async start(server) {
			const runs: Record<
				string,
				{ arch: string | null; cookie: string | null }[]
			> = {};
			const run = (url: string) => (runs[url.split("?")[1]] ??= []);
			server.on("request", (req, res) => {
				if (req.url!.startsWith("/doc?")) {
					const arch =
						(req.headers["sec-ch-ua-arch"] as string | undefined) ?? null;
					run(req.url!).push({ arch, cookie: req.headers.cookie ?? null });
					res.writeHead(arch === null ? 403 : 200, {
						"Content-Type": "text/html",
						"Accept-CH": "Sec-CH-UA-Arch",
						"Critical-CH": "Sec-CH-UA-Arch",
						"Set-Cookie": "challenge=" + req.url!.split("?")[1] + "; Path=/",
					});
					res.end(arch === null ? "challenged" : "served");
				} else if (req.url!.startsWith("/seen?")) {
					json(res, run(req.url!));
				}
			});
		},
	}),
	// a Critical-CH hint the same response does not ask for in Accept-CH is
	// never one the request could have carried, so nothing is made again
	serverTest({
		name: "request-critical-ch-without-accept-ch-not-restarted",
		hostname: "hints.runway.test",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const popup = window.open("/doc?" + id);
			let seen = 0;
			for (let i = 0; i < 100 && seen === 0; i++) {
				await new Promise((r) => setTimeout(r, 50));
				seen = await (await fetch("/seen?" + id)).json();
			}
			await new Promise((r) => setTimeout(r, 300));
			seen = await (await fetch("/seen?" + id)).json();
			popup?.close();
			assertEqual(seen, 1);
		`,
		async start(server) {
			const runs: Record<string, number> = {};
			server.on("request", (req, res) => {
				const id = req.url!.split("?")[1];
				if (req.url!.startsWith("/doc?")) {
					runs[id] = (runs[id] ?? 0) + 1;
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Critical-CH": "Sec-CH-UA-Arch",
					});
					res.end("served");
				} else if (req.url!.startsWith("/seen?")) {
					json(res, runs[id] ?? 0);
				}
			});
		},
	}),
	// a top-level document is its own policy's self: one opened from another
	// origin is sent the hints it asked for earlier
	serverTest({
		name: "request-client-hints-top-level-from-another-origin",
		hostname: "hints.runway.test",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const other = "https://b.hints.runway.test";
			// asked for by a document of its own, at the top level
			const asking = window.open(other + "/ask?" + id);
			for (let i = 0; i < 100; i++) {
				await new Promise((r) => setTimeout(r, 50));
				if ((await (await fetch("/seen?" + id)).json()).asked) break;
			}
			asking?.close();
			const popup = window.open(other + "/doc?" + id);
			let seen = null;
			for (let i = 0; i < 100 && seen === null; i++) {
				await new Promise((r) => setTimeout(r, 50));
				seen = (await (await fetch("/seen?" + id)).json()).arch;
			}
			popup?.close();
			assert(seen !== null && seen !== "none", "hint sent: " + seen);
		`,
		async start(server) {
			const runs: Record<string, string | null> = {};
			const asked: Record<string, boolean> = {};
			server.on("request", (req, res) => {
				const id = req.url!.split("?")[1];
				if (req.url!.startsWith("/ask?")) {
					asked[id] = true;
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Accept-CH": "Sec-CH-UA-Arch",
					});
					res.end("asked");
				} else if (req.url!.startsWith("/doc?")) {
					runs[id] =
						(req.headers["sec-ch-ua-arch"] as string | undefined) ?? "none";
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("doc");
				} else if (req.url!.startsWith("/seen?")) {
					json(res, { arch: runs[id] ?? null, asked: asked[id] ?? false });
				}
			});
		},
	}),
	// a meta Accept-CH is the document's alone: its own origin's requests
	// carry the hint, another origin's do not, and the next document's do not
	serverTest({
		name: "request-client-hints-meta-accept-ch-scoped",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const other = "http://127.0.0.1:" + location.port;
			const p1 = window.open("/meta?" + id);
			const wait = async (key) => {
				for (let i = 0; i < 100; i++) {
					await new Promise((r) => setTimeout(r, 50));
					const s = await (await fetch("/seen?" + id)).json();
					if (key in s) return s;
				}
				return await (await fetch("/seen?" + id)).json();
			};
			await wait("same");
			p1?.close();
			const p2 = window.open("/plain?" + id);
			const seen = await wait("later");
			p2?.close();
			assert(seen.same !== undefined && seen.same !== "none", "same origin: " + seen.same);
			assertEqual(seen.cross, "none", "another origin");
			assertEqual(seen.later, "none", "a later document");
		`,
		async start(server, port) {
			const runs: Record<string, Record<string, string>> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				const run = (runs[id] ??= {});
				const arch = (req.headers["sec-ch-ua-arch"] as string) ?? "none";
				if (path === "/meta") {
					run.doc = arch;
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html><head><meta http-equiv="Accept-CH" content="Sec-CH-UA-Arch"></head><body><script>
fetch("/probe-same?${id}").then(() => fetch("http://127.0.0.1:${port}/probe-cross?${id}", { mode: "no-cors" }));
</script></body>`);
				} else if (path === "/plain") {
					run.plainDoc = arch;
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						`<!doctype html><script>fetch("/probe-later?${id}")</script>`
					);
				} else if (path === "/probe-same") {
					run.same = arch;
					res.end();
				} else if (path === "/probe-cross") {
					run.cross = arch;
					res.end();
				} else if (path === "/probe-later") {
					run.later = arch;
					res.end();
				} else if (path === "/seen") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(run));
				}
			});
		},
	}),
];

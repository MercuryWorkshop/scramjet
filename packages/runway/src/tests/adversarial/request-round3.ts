import { serverTest } from "../../testcommon.ts";

const json = (res: any, value: unknown) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(value));
};

// polls /seen?id until `done(seen)`
const poll = `
	const poll = async (id, done) => {
		let seen;
		for (let i = 0; i < 100; i++) {
			await new Promise((r) => setTimeout(r, 50));
			seen = await (await fetch("/seen?" + id)).json();
			if (done(seen)) break;
		}
		return seen;
	};
`;

export default [
	// an iframe that redirects is still an iframe
	serverTest({
		name: "request-redirected-iframe-stays-iframe",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const f = document.createElement("iframe");
			const loaded = new Promise((r) => (f.onload = r));
			f.src = "/start?" + id;
			document.body.appendChild(f);
			await loaded;
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(seen.dest, "iframe");
		`,
		async start(server) {
			const runs: Record<string, string> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				if (path === "/start") {
					res.writeHead(302, { Location: "/viewer?" + id });
					res.end();
				} else if (path === "/viewer") {
					runs[id] = req.headers["sec-fetch-dest"] as string;
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("viewer");
				} else if (path === "/seen") {
					json(res, { dest: runs[id] ?? null });
				}
			});
		},
	}),
	// a fetch's mode overrides the one its Request was made with, whatever
	// that was
	serverTest({
		name: "request-mode-override-from-same-origin",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			const other = "http://127.0.0.1:" + location.port;
			const r = new Request(other + "/api?" + id, { mode: "same-origin" });
			await fetch(r, { mode: "cors" }).catch(() => {});
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(seen.origin, location.origin);
			assertEqual(seen.mode, "cors");
		`,
		async start(server) {
			const runs: Record<string, { origin: string | null; mode: string }> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				if (path === "/api") {
					runs[id] = {
						origin: (req.headers.origin as string) ?? null,
						mode: req.headers["sec-fetch-mode"] as string,
					};
					res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
					res.end();
				} else if (path === "/seen") {
					json(res, runs[id] ?? {});
				}
			});
		},
	}),
	// a hint other than the UA ones, asked for as critical, is restarted for
	serverTest({
		name: "request-critical-ch-color-scheme-restarts",
		autoPass: true,
		js: `
			${poll}
			const id = Math.random().toString(36).slice(2);
			const p = window.open("/doc?" + id);
			const seen = await poll(id, (s) => s.length >= 2);
			p?.close();
			assertEqual(seen.length, 2, "asked twice");
			assertEqual(seen[0], "none");
			assert(seen[1] !== "none", "second with it");
		`,
		async start(server) {
			const runs: Record<string, string[]> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				if (path === "/doc") {
					const v =
						(req.headers["sec-ch-prefers-color-scheme"] as string) ?? "none";
					(runs[id] ??= []).push(v);
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Accept-CH": "Sec-CH-Prefers-Color-Scheme",
						"Critical-CH": "Sec-CH-Prefers-Color-Scheme",
					});
					res.end("doc");
				} else if (path === "/seen") {
					json(res, runs[id] ?? []);
				}
			});
		},
	}),
	// Accept-CH fields are one list, and a critical hint in either is asked for
	serverTest({
		name: "request-critical-ch-repeated-accept-ch",
		autoPass: true,
		js: `
			${poll}
			const id = Math.random().toString(36).slice(2);
			const p = window.open("/doc?" + id);
			const seen = await poll(id, (s) => s.length >= 2);
			p?.close();
			assertEqual(seen.length, 2, "asked twice");
			assert(seen[1] !== "none", "second with it");
		`,
		async start(server) {
			const runs: Record<string, string[]> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				if (path === "/doc") {
					(runs[id] ??= []).push(
						(req.headers["sec-ch-ua-arch"] as string) ?? "none"
					);
					res.setHeader("Content-Type", "text/html");
					res.setHeader("Accept-CH", ["Sec-CH-UA-Arch", "Sec-CH-UA-Bitness"]);
					res.setHeader("Critical-CH", "Sec-CH-UA-Arch");
					res.end("doc");
				} else if (path === "/seen") {
					json(res, runs[id] ?? []);
				}
			});
		},
	}),
	// an insecure site is sent no UA hints at all, not even the low-entropy
	// ones the browser put on the request for the proxy's origin
	serverTest({
		name: "request-no-ua-hints-to-insecure-site",
		hostname: "plain.runway.test",
		scheme: "http",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			await fetch("/probe?" + id);
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(seen.ua, null);
		`,
		async start(server) {
			const runs: Record<string, string | null> = {};
			server.on("request", (req, res) => {
				const [path, id] = req.url!.split("?");
				if (path === "/probe") {
					runs[id] = (req.headers["sec-ch-ua"] as string) ?? null;
					res.end();
				} else if (path === "/seen") {
					json(res, { ua: runs[id] ?? null });
				}
			});
		},
	}),
];

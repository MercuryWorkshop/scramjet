import http from "http";
import type { AddressInfo } from "node:net";
import { serverTest, type Test } from "../../../testcommon.ts";

export const H = "text/html";
export const J = "application/javascript";

// extra origins (separate ports), served from inside start(). `files(mainPort, ports)`
export function withOrigins(
	name: string,
	js: string,
	files: (
		mainPort: number,
		ports: number[]
	) => Record<string, [string, string]>,
	opts: {
		n?: number;
		timeoutMs?: number;
		scramjetOnly?: boolean;
		mainFiles?: (
			mainPort: number,
			ports: number[]
		) => Record<string, [string, string]>;
	} = {}
): Test {
	const n = opts.n ?? 1;
	const servers: http.Server[] = [];
	const ports: number[] = [];
	const test = serverTest({
		name,
		autoPass: true,
		js,
		scramjetOnly: opts.scramjetOnly,
		start: async (server, port) => {
			for (let i = 0; i < n; i++) {
				const s = http.createServer((req, res) => {
					const f = files(port, ports)[(req.url || "/").split("?")[0]];
					if (!f) {
						res.writeHead(404);
						res.end();
						return;
					}
					res.writeHead(200, {
						"Content-Type": f[0],
					});
					res.end(f[1]);
				});
				await new Promise<void>((r) => s.listen(0, () => r()));
				servers.push(s);
				ports.push((s.address() as AddressInfo).port);
			}
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const u = (req.url || "/").split("?")[0];
				if (u === "/ports") {
					res.writeHead(200);
					res.end(JSON.stringify(ports));
					return;
				}
				const mf = opts.mainFiles?.(port, ports)[u];
				if (mf) {
					res.writeHead(200, {
						"Content-Type": mf[0],
					});
					res.end(mf[1]);
					return;
				}
				if (u !== "/" && u !== "/script.js") {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});
	const stop = test.stop;
	test.stop = async () => {
		for (const s of servers) {
			s.closeAllConnections?.();
			s.close();
		}
		await stop();
	};
	test.timeoutMs = opts.timeoutMs ?? 20000;
	return test;
}

// page-side prelude: P[i] = "http://localhost:<port>", waitMsg(pred, ms)
export const PRE = `
	const P = (await (await fetch("/ports")).json()).map((p) => "http://localhost:" + p);
	const waitMsg = (pred, ms = 4000, tgt = window) => new Promise((res) => {
		const h = (e) => { let ok = false; try { ok = pred(e); } catch {} if (ok) { tgt.removeEventListener("message", h); clearTimeout(t); res(e); } };
		const t = setTimeout(() => { tgt.removeEventListener("message", h); res(null); }, ms);
		tgt.addEventListener("message", h);
	});
`;

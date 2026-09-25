import http from "http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../../testcommon.ts";

export type LogEntry = {
	server: "A" | "B";
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
};
export type Reply =
	| string
	| {
			status?: number;
			headers?: Record<string, string | string[]>;
			body?: string;
	  };
export type Ctx = {
	A: string;
	B: string;
	C: string;
	log: LogEntry[];
};
export type Route = (req: LogEntry, ctx: Ctx) => Reply | undefined;

/** helper script available on every page as rep({...}) */
export const REP = `<script>
window.rep = (d) => fetch("/report", { method: "POST", keepalive: true, body: JSON.stringify(Object.assign({
	path: location.pathname + location.search, href: location.href, ref: document.referrer,
	cookie: document.cookie, hist: history.length, name: window.name }, d || {})) });
</script>`;

export const page = (body: string) =>
	`<!doctype html><html><head><meta charset="utf-8">${REP}</head><body>${body}</body></html>`;

function listen(server: http.Server): Promise<number> {
	return new Promise((resolve) =>
		server.listen(0, () => resolve((server.address() as AddressInfo).port))
	);
}

/**
 * routes: path (pathname) -> reply. `${A}`/`${B}`/`${C}` in string bodies and
 * headers are replaced by the origins (A = main, B = second port on localhost,
 * C = second port on 127.0.0.1 i.e. cross-site).
 * check(reports, ctx): undefined = keep waiting, true = pass, string = fail.
 */
export function nav(props: {
	name: string;
	routes: Record<string, Route | Reply>;
	check: (reports: any[], ctx: Ctx) => true | string | undefined;
}): Test {
	let a: http.Server, b: http.Server;
	const test: Test = {
		name: props.name,
		port: 0,
		scramjetOnly: true,
		async start({ pass, fail }) {
			const ctx: Ctx = {
				A: "",
				B: "",
				C: "",
				log: [],
			};
			const reports: any[] = [];
			let settled = false;
			const sub = (s: string) =>
				s
					.replaceAll("${A}", ctx.A)
					.replaceAll("${B}", ctx.B)
					.replaceAll("${C}", ctx.C);
			const handler =
				(which: "A" | "B") =>
				(req: http.IncomingMessage, res: http.ServerResponse) => {
					let body = "";
					req.setEncoding("latin1");
					req.on("data", (c) => (body += c));
					req.on("end", () => {
						const entry: LogEntry = {
							server: which,
							method: req.method!,
							url: req.url!,
							headers: req.headers,
							body,
						};
						const path = new URL(req.url!, "http://x").pathname;
						if (path === "/report") {
							res.writeHead(204, {
								"Access-Control-Allow-Origin": "*",
							});
							res.end();
							try {
								reports.push(JSON.parse(body));
							} catch {
								reports.push({
									raw: body,
								});
							}
							if (settled) return;
							let r: true | string | undefined;
							try {
								r = props.check(reports, ctx);
							} catch (e) {
								r = "check threw: " + e;
							}
							if (r === true) {
								settled = true;
								void pass("ok", {
									reports,
								});
							} else if (typeof r === "string") {
								settled = true;
								void fail(r, {
									reports,
									log: ctx.log.map(
										(l) =>
											`${l.server} ${l.method} ${l.url} ref=${l.headers.referer ?? "-"} cookie=${l.headers.cookie ?? "-"} ct=${l.headers["content-type"] ?? "-"} body=${l.body.slice(0, 200)}`
									),
								});
							}
							return;
						}
						if (path === "/favicon.ico") {
							res.writeHead(404);
							res.end();
							return;
						}
						ctx.log.push(entry);
						let route = props.routes[path];
						let reply: Reply | undefined =
							typeof route === "function" ? route(entry, ctx) : route;
						if (reply === undefined) {
							res.writeHead(404, {
								"Content-Type": "text/plain",
							});
							res.end("nf " + path);
							return;
						}
						if (typeof reply === "string")
							reply = {
								body: reply,
							};
						const headers: Record<string, string | string[]> = {
							"Content-Type": "text/html; charset=utf-8",
							"Cache-Control": "no-store",
						};
						for (const [k, v] of Object.entries(reply.headers ?? {}))
							headers[k] = Array.isArray(v) ? v.map(sub) : sub(v);
						res.writeHead(reply.status ?? 200, headers);
						res.end(sub(reply.body ?? ""));
					});
				};
			a = http.createServer(handler("A"));
			b = http.createServer(handler("B"));
			const pa = await listen(a);
			const pb = await listen(b);
			ctx.A = `http://localhost:${pa}`;
			ctx.B = `http://localhost:${pb}`;
			ctx.C = `http://127.0.0.1:${pb}`;
			test.port = pa;
			setTimeout(() => {
				if (settled) return;
				settled = true;
				void fail("server-side timeout", {
					reports,
					log: ctx.log.map(
						(l) =>
							`${l.server} ${l.method} ${l.url} ref=${l.headers.referer ?? "-"}`
					),
				});
			}, 12000);
		},
		async stop() {
			for (const s of [a, b]) {
				s?.closeAllConnections?.();
				await new Promise<void>((r) => (s ? s.close(() => r()) : r()));
			}
		},
	};
	return test;
}

/** last report with a given path prefix */
export const find = (reports: any[], pred: (r: any) => boolean) => {
	for (let i = reports.length - 1; i >= 0; i--)
		if (pred(reports[i])) return reports[i];
	return undefined;
};
export const req = (ctx: Ctx, pred: (l: LogEntry) => boolean) =>
	ctx.log.find(pred);
export function expect(cond: boolean, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}
/** wrap a check that throws into the tri-state */
export const chk =
	(
		ready: (reports: any[], ctx: Ctx) => boolean,
		fn: (reports: any[], ctx: Ctx) => void
	) =>
	(reports: any[], ctx: Ctx): true | string | undefined => {
		const err = find(reports, (r) => r.error);
		if (err) return "page error: " + err.error;
		if (!ready(reports, ctx)) return undefined;
		try {
			fn(reports, ctx);
			return true;
		} catch (e: any) {
			return e.message;
		}
	};

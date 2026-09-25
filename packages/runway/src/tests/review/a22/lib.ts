import http from "http";
import type { AddressInfo } from "node:net";
import type { Frame, Page } from "playwright";
import { playwrightTest, type Test } from "../../../testcommon.ts";

/* eslint-disable quotes */

/**
 * Tracing shell, put in <head> of every fixture page. Every entry survives
 * reloads and navigations (sessionStorage), and `__run(src)` evaluates code as
 * page code (so the proxy's rewriter sees it).
 */
export const SHELL = `<script>
(function(){
	const K = "__rv22t";
	const snap = () => ({ href: location.href, url: document.URL, base: document.baseURI, len: history.length,
		st: (() => { try { return JSON.stringify(history.state).slice(0, 120); } catch (e) { return "ERR"; } })(),
		view: (document.getElementById("view") || {}).textContent });
	window.__log = (ev, extra) => {
		const t = JSON.parse(sessionStorage.getItem(K) || "[]");
		t.push(Object.assign({ ev }, snap(), extra || {}));
		sessionStorage.setItem(K, JSON.stringify(t));
	};
	window.__trace = () => JSON.parse(sessionStorage.getItem(K) || "[]");
	window.__clear = () => sessionStorage.removeItem(K);
	window.__run = function (src) { return eval(src); };
	window.__loadid = Math.random().toString(36).slice(2, 7);
	__log("load", { ref: document.referrer, name: window.name, nav: (performance.getEntriesByType("navigation")[0] || {}).type });
	addEventListener("popstate", (e) => __log("popstate", { est: JSON.stringify(e.state) }));
	addEventListener("hashchange", (e) => __log("hashchange", { old: e.oldURL, new: e.newURL }));
	addEventListener("pageshow", (e) => __log("pageshow", { persisted: e.persisted }));
	addEventListener("error", (e) => __log("error", { msg: String(e.message) }));
	addEventListener("unhandledrejection", (e) => __log("rejection", { msg: String(e.reason && e.reason.message || e.reason) }));
})();
</script>`;

export type Routes = Record<
	string,
	| string
	| ((
			url: URL,
			req: http.IncomingMessage
	  ) =>
			| {
					status?: number;
					headers?: Record<string, string>;
					body: string;
			  }
			| string
			| undefined)
>;

export async function startFixture(routes: Routes, fallback?: string) {
	const log: string[] = [];
	const server = http.createServer((req, res) => {
		const u = new URL(req.url!, "http://x");
		log.push(`${req.method} ${req.url} ref=${req.headers.referer ?? "-"}`);
		let r = routes[u.pathname];
		let out: any = typeof r === "function" ? r(u, req) : r;
		if (out === undefined && fallback !== undefined) out = routes[fallback];
		if (typeof out === "function") out = out(u, req);
		if (out === undefined) {
			res.writeHead(404, {
				"content-type": "text/plain",
			});
			res.end("nf");
			return;
		}
		if (typeof out === "string")
			out = {
				body: out,
			};
		res.writeHead(out.status ?? 200, {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			...(out.headers ?? {}),
		});
		res.end(out.body);
	});
	await new Promise<void>((r) => server.listen(0, () => r()));
	const port = (server.address() as AddressInfo).port;
	return {
		port,
		origin: `http://localhost:${port}`,
		log,
		close: () =>
			new Promise<void>((r) => {
				server.closeAllConnections?.();
				server.close(() => r());
			}),
	};
}

export type H = {
	origin: string;
	frame: () => Promise<Frame>;
	run: (src: string) => Promise<any>;
	click: (sel: string) => Promise<void>;
	wait: (ms: number) => Promise<void>;
	goBack: () => Promise<void>;
	goForward: () => Promise<void>;
	trace: () => Promise<any[]>;
	mark: (label: string) => Promise<void>;
	serverLog: string[];
};

export type Scenario = {
	name: string;
	routes: Routes;
	fallback?: string;
	start: string; // path
	steps: (h: H) => Promise<void>;
	timeoutMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function drive(
	page: Page,
	getFrame: () => Promise<Frame>,
	fx: Awaited<ReturnType<typeof startFixture>>,
	sc: Scenario,
	bare: boolean
) {
	const run = async (src: string) => {
		for (let i = 0; i < 40; i++) {
			try {
				const f = await getFrame();
				return await f.evaluate(
					(s) =>
						(window as any).__run
							? (window as any).__run(s)
							: Promise.reject(new Error("no __run")),
					src
				);
			} catch (e: any) {
				if (
					/no __run|Execution context was destroyed|detached|navigat/i.test(
						String(e.message)
					)
				) {
					await sleep(150);
					continue;
				}
				throw e;
			}
		}
		throw new Error("run: frame never ready");
	};
	const h: H = {
		origin: fx.origin,
		frame: getFrame,
		run,
		click: async (sel) => {
			const f = await getFrame();
			await f.click(sel, {
				timeout: 5000,
				noWaitAfter: true,
			} as any);
		},
		wait: sleep,
		goBack: async () => {
			await page
				.goBack({
					waitUntil: "commit",
					timeout: 3000,
				})
				.catch(() => {});
			await sleep(600);
		},
		goForward: async () => {
			await page
				.goForward({
					waitUntil: "commit",
					timeout: 3000,
				})
				.catch(() => {});
			await sleep(600);
		},
		trace: async () => run("__trace()"),
		mark: async (label) => {
			await run(`__log("mark", { label: ${JSON.stringify(label)} })`);
		},
		serverLog: fx.log,
	};
	await sc.steps(h);
	const t = await h.trace();
	// normalise the port away
	const norm = (x: any) =>
		JSON.parse(
			JSON.stringify(x)
				.replaceAll(fx.origin, "O")
				.replaceAll(`localhost:${fx.port}`, "HOST")
		);
	return {
		trace: norm(t),
		log: norm(fx.log),
	};
}

export function scenarioTest(sc: Scenario): Test {
	return Object.assign(
		playwrightTest({
			name: "rv22-" + sc.name,
			fn: async ({ page, navigate }) => {
				const fx = await startFixture(sc.routes, sc.fallback);
				const errs: string[] = [];
				const onErr = (e: Error) => errs.push(String(e.message).slice(0, 200));
				page.on("pageerror", onErr);
				try {
					const getFrame = async () => {
						const el = await page.$("#testframe");
						const f = await el!.contentFrame();
						if (!f) throw new Error("detached");
						return f;
					};
					await navigate(fx.origin + sc.start);
					await sleep(1500);
					const out = await drive(page, getFrame, fx, sc, false);
					console.log(
						"RV22OUT " +
							sc.name +
							" " +
							JSON.stringify({
								...out,
								pageerrors: errs,
							})
					);
				} finally {
					page.off("pageerror", onErr);
					await fx.close();
				}
			},
		}),
		{
			timeoutMs: sc.timeoutMs ?? 90000,
		}
	);
}

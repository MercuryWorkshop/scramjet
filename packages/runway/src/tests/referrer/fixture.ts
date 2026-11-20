import http from "http";
import type { AddressInfo, Socket } from "node:net";
import type { Test } from "../../testcommon.ts";

/**
 * Shared fixture for the referrer suite.
 *
 * Every test gets two servers, which between them give the page three
 * origins to send requests to:
 *
 * - `MAIN`  `http://localhost:P` - the page's own origin
 * - `ALT`   `http://localhost:Q` - cross-origin, same-site
 * - `XSITE` `http://127.0.0.1:P` - cross-site
 *
 * An `https` test is served as `https://site.test` instead (scramjet only, via
 * the runway cleartext transport), with `https://alt.site.test` as `ALT`,
 * `https://other.test` as `XSITE` and `http://localhost:P` as `INSECURE`, the
 * target of a downgrade.
 *
 * The page's URL is `PAGE`, which has a path and a query so a full referrer
 * can be told apart from an origin-only one.
 *
 * Routes, on every origin:
 *
 * - `/r/<id>[.ext]` records the Referer it was requested with under `<id>`
 *   and answers by extension (`.png` an image, `.css`, `.js`, `.html`,
 *   anything else text). `?ct=` and `?body=` override the type and the body,
 *   `?rp=` (repeatable) adds a Referrer-Policy header and `?to=` makes it a
 *   302 to that URL.
 * - `/doc/<id>` records the same way and serves a document that posts
 *   `{ __ref: id, referrer: document.referrer, ... }` to its opener or parent,
 *   after running `?js=`. `?head=` goes into its head, `?rp=` as above.
 * - `/seen?id=<id>` answers `{ found, referer, count, scramjetHeaders,
 *   cookie, origin }`, `referer` being null when the request had no Referer
 *   header, `scramjetHeaders` naming any `x-scramjet-` header that reached the
 *   site, and `cookie` and `origin` the headers of those names, or null.
 * - `/lib.js` the page-side helpers, see {@link LIB}.
 */

const GIF = Buffer.from(
	"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
	"base64"
);

const PAGE_PATH = "/page/main.html?q=1";

export type ReferrerTestProps = {
	name: string;
	/** Body of the test, run inside `runTest` on `PAGE`. */
	js: string;
	/** Headers for `PAGE` itself, e.g. `Referrer-Policy`. */
	pageHeaders?: Record<string, string | string[]>;
	/** Markup placed in `PAGE`'s head before the helpers. */
	head?: string;
	/** Markup placed in `PAGE`'s body before the test script. */
	body?: string;
	/** Serve `PAGE` as `https://site.test` (scramjet only). */
	https?: boolean;
	scramjetOnly?: boolean;
	timeoutMs?: number;
};

function lib(origins: Record<string, string>, page: string) {
	return `
const ORIGINS = ${JSON.stringify(origins)};
const MAIN = ORIGINS.MAIN, ALT = ORIGINS.ALT, XSITE = ORIGINS.XSITE, INSECURE = ORIGINS.INSECURE;
const PAGE = ${JSON.stringify(page)};

function uid(tag) {
	return (tag || "r") + "-" + Math.random().toString(36).slice(2, 10);
}

function qs(params) {
	const search = new URLSearchParams();
	for (const [k, v] of Object.entries(params || {})) {
		if (Array.isArray(v)) for (const item of v) search.append(k, item);
		else if (v !== undefined) search.set(k, v);
	}
	const s = search.toString();
	return s ? "?" + s : "";
}

/** URL of a recording resource. */
function rurl(origin, id, params, ext) {
	return origin + "/r/" + id + (ext || "") + qs(params);
}

/** URL of a recording document that reports its document.referrer. */
function durl(origin, id, params) {
	return origin + "/doc/" + id + qs(params);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The Referer header the request recorded under \`id\` carried (null for none). */
async function seen(id, timeout = 8000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const res = await fetch("/seen" + qs({ id }), { cache: "no-store" });
		const body = await res.json();
		if (body.found) return body.referer;
		await sleep(40);
	}
	throw new Error("the request for " + id + " never arrived");
}

/** Everything \`/seen\` recorded for \`id\`, once it arrives. */
async function seenAll(id) {
	await seen(id);
	return (await fetch("/seen" + qs({ id }), { cache: "no-store" })).json();
}

async function expectRef(id, expected, label) {
	const actual = await seen(id);
	assertEqual(actual, expected, (label || id) + ": Referer header was " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
}

/** Resolves with the \`n\`th report posted by the document recorded as \`id\`. */
function msg(id, n = 1, timeout = 10000) {
	return new Promise((resolve, reject) => {
		let count = 0;
		const timer = setTimeout(() => {
			removeEventListener("message", onmessage);
			reject(new Error("no report " + n + " from document " + id));
		}, timeout);
		function onmessage(e) {
			if (!e.data || e.data.__ref !== id) return;
			if (++count < n) return;
			clearTimeout(timer);
			removeEventListener("message", onmessage);
			resolve(e.data);
		}
		addEventListener("message", onmessage);
	});
}

function makeFrame(attrs, parent) {
	const f = document.createElement("iframe");
	let src;
	for (const [k, v] of Object.entries(attrs || {})) {
		if (k === "src") src = v;
		else f.setAttribute(k, v);
	}
	if (src !== undefined) f.src = src;
	(parent || document.body).append(f);
	return f;
}

/** Load a recording document in a new iframe; resolves with { doc, header }. */
async function frameRef(url, id, attrs) {
	const report = msg(id);
	makeFrame({ ...(attrs || {}), src: url });
	const data = await report;
	return { doc: data.referrer, header: await seen(id), data };
}

/**
 * Load a recording document in a new iframe and check its Referer header
 * and document.referrer, which is \`expectedDoc\` where the two differ.
 */
async function expectFrame(url, id, expected, label, attrs, expectedDoc = expected ?? "") {
	const { doc, header } = await frameRef(url, id, attrs);
	assertEqual(header, expected, label + ": navigation Referer header was " + JSON.stringify(header) + ", expected " + JSON.stringify(expected));
	assertEqual(doc, expectedDoc, label + ": document.referrer was " + JSON.stringify(doc) + ", expected " + JSON.stringify(expectedDoc));
}

/** Insert an element and wait for it to load or fail. */
function loadEl(tag, attrs, parent) {
	return new Promise((resolve) => {
		const el = (parent ? parent.ownerDocument : document).createElement(tag);
		let src;
		for (const [k, v] of Object.entries(attrs || {})) {
			if (k === "src" || k === "href") src = [k, v];
			else el.setAttribute(k, v);
		}
		el.onload = () => resolve(el);
		el.onerror = () => resolve(el);
		if (src) el.setAttribute(src[0], src[1]);
		(parent || (tag === "link" ? document.head : document.body)).append(el);
	});
}

/** Resolves on the worker's first message, rejects if it fails to load. */
function workerDone(w) {
	return new Promise((resolve, reject) => {
		w.onmessage = resolve;
		w.onerror = () => reject(new Error("the worker failed to load"));
	});
}

function xhr(url) {
	return new Promise((resolve) => {
		const x = new XMLHttpRequest();
		x.open("GET", url);
		x.onloadend = () => resolve(x);
		x.send();
	});
}

/** Result of \`fn\`, or "threw <name>" if it throws. */
async function attempt(fn) {
	try {
		return await fn();
	} catch (e) {
		return "threw " + (e && e.name);
	}
}
`;
}

function docHtml(id: string, js: string, head: string) {
	return `<!doctype html><html><head>${head}<script src="/lib.js"></script></head><body><script>
(async () => {
	const report = { __ref: ${JSON.stringify(id)}, referrer: document.referrer, href: location.href };
	const target = window.opener || (parent !== window ? parent : null);
	try {
		${js}
	} catch (e) {
		report.error = String(e && e.message || e);
	}
	if (target && !window.__noReport) target.postMessage(report, "*");
})();
</script></body></html>`;
}

function mainHtml(props: ReferrerTestProps) {
	return `<!doctype html><html><head>${props.head ?? ""}<script src="/lib.js"></script></head><body>${props.body ?? ""}<script>
runTest(async () => {
${props.js}
}, true);
</script></body></html>`;
}

function listen(server: http.Server): Promise<number> {
	return new Promise((resolve) => {
		server.listen(0, () => resolve((server.address() as AddressInfo).port));
	});
}

export function referrerTest(props: ReferrerTestProps): Test {
	const servers: http.Server[] = [];
	const sockets = new Set<Socket>();
	const seen = new Map<
		string,
		{
			referer: string | null;
			count: number;
			scramjetHeaders: string[];
			cookie: string | null;
			origin: string | null;
		}
	>();

	const test: Test = {
		name: props.name,
		port: 0,
		path: PAGE_PATH,
		hostname: props.https ? "site.test" : undefined,
		cleartextHosts: props.https ? ["other.test"] : undefined,
		scramjetOnly: props.scramjetOnly ?? !!props.https,
		timeoutMs: props.timeoutMs,
		async start() {
			seen.clear();
			let mainPort = 0;
			let altPort = 0;
			const origins = () =>
				props.https
					? {
							MAIN: "https://site.test",
							ALT: "https://alt.site.test",
							XSITE: "https://other.test",
							INSECURE: `http://localhost:${mainPort}`,
						}
					: {
							MAIN: `http://localhost:${mainPort}`,
							ALT: `http://localhost:${altPort}`,
							XSITE: `http://127.0.0.1:${mainPort}`,
						};

			const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
				const url = new URL(req.url ?? "/", "http://localhost");
				const referer = req.headers.referer ?? null;
				const cors = { "Access-Control-Allow-Origin": "*" };
				const policies = url.searchParams.getAll("rp");
				const rpHeaders: Record<string, string | string[]> = policies.length
					? {
							"Referrer-Policy": policies.length === 1 ? policies[0] : policies,
						}
					: {};

				const record = (id: string) => {
					const prev = seen.get(id);
					seen.set(id, {
						referer,
						count: (prev?.count ?? 0) + 1,
						// anything of the proxy's own that reached the site
						scramjetHeaders: Object.keys(req.headers).filter((name) =>
							name.startsWith("x-scramjet-")
						),
						cookie: req.headers.cookie ?? null,
						origin: req.headers.origin ?? null,
					});
				};

				if (url.pathname === "/page/main.html") {
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						...props.pageHeaders,
					});
					res.end(mainHtml(props));
					return;
				}
				if (url.pathname === "/lib.js") {
					const o = origins();
					res.writeHead(200, {
						"Content-Type": "text/javascript",
						"Cache-Control": "no-store",
					});
					res.end(lib(o, o.MAIN + PAGE_PATH));
					return;
				}
				if (url.pathname === "/seen") {
					const entry = seen.get(url.searchParams.get("id") ?? "");
					res.writeHead(200, {
						"Content-Type": "application/json",
						"Cache-Control": "no-store",
						...cors,
					});
					res.end(
						JSON.stringify({
							found: !!entry,
							referer: entry?.referer ?? null,
							count: entry?.count ?? 0,
							scramjetHeaders: entry?.scramjetHeaders ?? [],
							cookie: entry?.cookie ?? null,
							origin: entry?.origin ?? null,
						})
					);
					return;
				}
				if (url.pathname.startsWith("/r/")) {
					const file = url.pathname.slice(3);
					const dot = file.lastIndexOf(".");
					const id = dot === -1 ? file : file.slice(0, dot);
					const ext = dot === -1 ? "" : file.slice(dot + 1);
					record(id);

					const to = url.searchParams.get("to");
					if (to) {
						res.writeHead(302, {
							Location: to,
							"Cache-Control": "no-store",
							...cors,
							...rpHeaders,
						});
						res.end();
						return;
					}

					const types: Record<string, string> = {
						png: "image/gif",
						css: "text/css",
						js: "text/javascript",
						html: "text/html",
					};
					const ct = url.searchParams.get("ct") ?? types[ext] ?? "text/plain";
					const body = url.searchParams.get("body");
					res.writeHead(200, {
						"Content-Type": ct,
						"Cache-Control": "no-store",
						...cors,
						...rpHeaders,
					});
					res.end(body ?? (ext === "png" ? GIF : ""));
					return;
				}
				if (url.pathname.startsWith("/doc/")) {
					const id = url.pathname.slice(5);
					record(id);
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-store",
						...rpHeaders,
					});
					res.end(
						docHtml(
							id,
							url.searchParams.get("js") ?? "",
							url.searchParams.get("head") ?? ""
						)
					);
					return;
				}

				res.writeHead(404, cors);
				res.end("not found");
			};

			const make = async () => {
				const server = http.createServer(handler);
				server.on("connection", (socket) => {
					sockets.add(socket);
					socket.on("close", () => sockets.delete(socket));
				});
				servers.push(server);
				return listen(server);
			};

			mainPort = await make();
			if (!props.https) altPort = await make();
			test.port = mainPort;
		},
		async stop() {
			for (const socket of sockets) socket.destroy();
			sockets.clear();
			await Promise.all(
				servers.splice(0).map(
					(server) =>
						new Promise<void>((resolve) => {
							server.closeAllConnections?.();
							server.close(() => resolve());
						})
				)
			);
		},
	};
	return test;
}

export const POLICIES = [
	"no-referrer",
	"no-referrer-when-downgrade",
	"same-origin",
	"origin",
	"strict-origin",
	"origin-when-cross-origin",
	"strict-origin-when-cross-origin",
	"unsafe-url",
] as const;

export type Policy = (typeof POLICIES)[number];

/**
 * What a request under `policy` carries, as page-side expressions, for a
 * same-origin target and a cross-origin one of the same scheme.
 */
export const EXPECT: Record<Policy, { same: string; cross: string }> = {
	"no-referrer": { same: "null", cross: "null" },
	"no-referrer-when-downgrade": { same: "PAGE", cross: "PAGE" },
	"same-origin": { same: "PAGE", cross: "null" },
	origin: { same: 'MAIN + "/"', cross: 'MAIN + "/"' },
	"strict-origin": { same: 'MAIN + "/"', cross: 'MAIN + "/"' },
	"origin-when-cross-origin": { same: "PAGE", cross: 'MAIN + "/"' },
	"strict-origin-when-cross-origin": { same: "PAGE", cross: 'MAIN + "/"' },
	"unsafe-url": { same: "PAGE", cross: "PAGE" },
};

/** What an https page's request under `policy` carries to an http target. */
export const EXPECT_DOWNGRADE: Record<Policy, string> = {
	"no-referrer": "null",
	"no-referrer-when-downgrade": "null",
	"same-origin": "null",
	origin: 'MAIN + "/"',
	"strict-origin": "null",
	"origin-when-cross-origin": 'MAIN + "/"',
	"strict-origin-when-cross-origin": "null",
	"unsafe-url": "PAGE",
};

/**
 * Page-side code checking that fetches to every kind of target carry what
 * `policy` says, with `init` as the fetch options.
 */
export function fetchMatrix(policy: Policy, init = "{}") {
	const e = EXPECT[policy];
	return `
	{
		const init = ${init};
		const same = uid("same"), alt = uid("alt"), xsite = uid("xsite");
		await fetch(rurl(MAIN, same), init);
		await fetch(rurl(ALT, alt), init);
		await fetch(rurl(XSITE, xsite), init);
		await expectRef(same, ${e.same}, ${JSON.stringify(policy)} + " same-origin fetch");
		await expectRef(alt, ${e.cross}, ${JSON.stringify(policy)} + " cross-origin fetch");
		await expectRef(xsite, ${e.cross}, ${JSON.stringify(policy)} + " cross-site fetch");
	}`;
}

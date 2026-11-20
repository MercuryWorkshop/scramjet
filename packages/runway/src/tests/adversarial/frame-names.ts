import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Frame, Page } from "playwright";
import { basicTest, playwrightTest } from "../../testcommon.ts";

// Browsing context names: `window.name`, and every navigation target that is
// resolved against one - `_top`, `_parent`, named frames, `window.open`.
//
// The test frame is the emulated *top-level* traversable. It is really an
// iframe in the harness, so every keyword that climbs out of it (`_top`, and
// `_parent` from the top) has to be kept inside it, and the name scramjet
// uses to do that must never be what the page sees. What the page sees is
// what a real top-level tab would show it:
//
//   https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-name
//   https://html.spec.whatwg.org/multipage/document-sequences.html#the-rules-for-choosing-a-navigable
//   https://html.spec.whatwg.org/multipage/browsing-the-web.html#finalize-a-cross-document-navigation (step 4)
//
// These drive the harness directly, so they can check the thing a page cannot:
// which frame actually navigated, and that the harness itself never did.

// ---------------------------------------------------------------------------
// the site
// ---------------------------------------------------------------------------

type Hit = { id: string; data: any };

type Site = {
	port: number;
	/** `http://localhost:port` */
	a: string;
	/** `http://127.0.0.1:port` - cross-origin and cross-site to `a` */
	b: string;
	page(path: string, html: string): void;
	/** Serve `html` exactly, with nothing of the wrapper's around it. */
	raw(path: string, html: string): void;
	waitHit(id: string, timeout?: number): Promise<any>;
	hit(id: string): any;
	close(): Promise<void>;
};

/**
 * `report(id, data)` in any page POSTs to the site, which is how a document
 * that replaced the one the test was talking to says it arrived.
 * `/land/<id>` is a page that does nothing but that.
 */
const REPORT_JS = `
	// code handed over by the test runs through the page's own \`eval\`, so it
	// is rewritten like any script the site wrote - Playwright's evaluate is
	// not, and would read the proxy's globals rather than the site's
	window.__pv = (src, arg) => (0, eval)("(" + src + ")")(arg);
	window.report = (id, data) => fetch("/__hit/" + id, {
		method: "POST",
		body: JSON.stringify(data === undefined ? {} : data),
	});
`;

const LAND = (id: string) =>
	`<!doctype html><html><body>landed ${id}<script>${REPORT_JS}
		report(${JSON.stringify(id)}, {
			name: window.name,
			path: location.pathname,
			origin: location.origin,
		});
	</script></body></html>`;

async function startSite(): Promise<Site> {
	const pages = new Map<string, string>();
	const hits = new Map<string, any>();
	const waiters = new Map<string, ((data: any) => void)[]>();

	const server = http.createServer((req, res) => {
		const path = (req.url || "/").split("?")[0];
		if (path.startsWith("/__hit/")) {
			const id = decodeURIComponent(path.slice("/__hit/".length));
			const chunks: Buffer[] = [];
			req.on("data", (c) => chunks.push(c));
			req.on("end", () => {
				let data: any = null;
				try {
					data = JSON.parse(Buffer.concat(chunks).toString() || "null");
				} catch {}
				hits.set(id, data);
				for (const w of waiters.get(id) ?? []) w(data);
				waiters.delete(id);
				res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
				res.end();
			});
			return;
		}
		if (path.startsWith("/land/")) {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(LAND(decodeURIComponent(path.slice("/land/".length))));
			return;
		}
		const html = pages.get(path);
		if (html === undefined) {
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("nf");
			return;
		}
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
	});

	await new Promise<void>((r) => server.listen(0, r));
	const port = (server.address() as AddressInfo).port;

	return {
		port,
		a: `http://localhost:${port}`,
		b: `http://127.0.0.1:${port}`,
		raw(path: string, html: string) {
			pages.set(path, html);
		},
		page(path, html) {
			pages.set(
				path,
				`<!doctype html><html><head><script>${REPORT_JS}</script></head><body>${html}</body></html>`
			);
		},
		hit: (id) => hits.get(id),
		waitHit(id, timeout = 10000) {
			if (hits.has(id)) return Promise.resolve(hits.get(id));
			return new Promise((resolve, reject) => {
				const t = setTimeout(
					() => reject(new Error(`timed out waiting for "${id}"`)),
					timeout
				);
				const list = waiters.get(id) ?? [];
				list.push((d) => {
					clearTimeout(t);
					resolve(d);
				});
				waiters.set(id, list);
			});
		},
		close: () =>
			new Promise<void>((r) => {
				server.closeAllConnections?.();
				server.close(() => r());
			}),
	};
}

// ---------------------------------------------------------------------------
// the harness
// ---------------------------------------------------------------------------

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

function assertEqual(actual: unknown, expected: unknown, msg: string) {
	if (
		!Object.is(actual, expected) &&
		JSON.stringify(actual) !== JSON.stringify(expected)
	) {
		throw new Error(
			`${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
		);
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(
	fn: () => Promise<T>,
	msg: string,
	timeout = 10000
): Promise<T> {
	const end = Date.now() + timeout;
	let last: unknown;
	while (Date.now() < end) {
		try {
			const v = await fn();
			if (v) return v;
		} catch (e) {
			last = e;
		}
		await sleep(50);
	}
	throw new Error(`timed out: ${msg}${last ? ` (${last})` : ""}`);
}

/** The emulated top-level document, as a Playwright frame. */
async function topFrame(page: Page, selector = "#testframe"): Promise<Frame> {
	const handle = await page.$(selector);
	assert(handle, `no ${selector} in the harness`);
	const frame = await handle.contentFrame();
	assert(frame, `${selector} has no content frame`);
	return frame;
}

/**
 * Run `fn` in `frame` as the site's own script would run - see `__pv` above.
 * Only in documents the site served; a srcdoc or written frame is driven
 * through clicks instead.
 */
async function pv<A, R>(
	frame: Frame,
	fn: (arg: A) => R,
	arg?: A
): Promise<Awaited<R>> {
	return frame.evaluate(([src, a]) => (window as any).__pv(src, a), [
		String(fn),
		arg,
	] as const) as Promise<Awaited<R>>;
}

/**
 * The site URL a frame is showing, path and query, read out of the proxy URL
 * the harness sees - which is how one frame is told apart from another.
 */
async function pathOf(frame: Frame): Promise<string> {
	const m = /\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/.exec(frame.url());
	if (!m) return frame.url();
	const u = new URL(decodeURIComponent(m[1]));
	return u.pathname + u.search;
}

/** The child frames of `frame` whose document is at `path`. */
async function child(frame: Frame, path: string): Promise<Frame> {
	return waitFor(async () => {
		for (const f of frame.childFrames()) {
			try {
				if (
					(await pathOf(f)) === path &&
					(await f.evaluate(() => typeof (window as any).__pv === "function"))
				)
					return f;
			} catch {}
		}
		return null;
	}, `a child frame at ${path}`);
}

/** Navigate the test frame through the proxy and wait for the document. */
async function open(
	page: Page,
	navigate: (u: string) => Promise<void>,
	url: string
) {
	await navigate(url);
	const path = new URL(url).pathname + new URL(url).search;
	await waitFor(async () => {
		const f = await topFrame(page);
		return (
			(await pathOf(f)) === path &&
			(await pv(f, () => document.readyState === "complete"))
		);
	}, `the test frame loading ${url}`);
	return topFrame(page);
}

/**
 * The harness is the page scramjet is embedded in. A target that escapes the
 * emulated top-level navigates *this*, which takes down the whole browser
 * around the site.
 */
async function assertHarnessIntact(page: Page) {
	const ok = await page
		.evaluate(
			() =>
				typeof (window as any).__runwayNavigate === "function" &&
				!!document.getElementById("testframe")
		)
		.catch(() => false);
	assert(
		ok,
		"the harness page itself was navigated - a target escaped the emulated top-level"
	);
}

/** Everything a page could read back that would betray a scramjet-chosen name. */
async function assertNameInvisible(
	frame: Frame,
	expected: string,
	where: string
) {
	const seen = await pv(frame, () => {
		const d = Object.getOwnPropertyDescriptor(window, "name")!;
		return {
			name: window.name,
			self: self.name,
			viaGetter: d.get!.call(window),
			viaGlobalThis: (globalThis as any).name,
		};
	});
	assertEqual(
		seen,
		{
			name: expected,
			self: expected,
			viaGetter: expected,
			viaGlobalThis: expected,
		},
		`${where}: window.name as the page reads it`
	);
}

type Ctx = { page: Page; navigate: (u: string) => Promise<void>; site: Site };

/** A playwright test with a fresh site, torn down however it ends. */
function nameTest(name: string, fn: (ctx: Ctx) => Promise<void>) {
	return playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const site = await startSite();
			const extraPages: Page[] = [];
			const onPage = (p: Page) => extraPages.push(p);
			page.context().on("page", onPage);
			try {
				await fn({ page, navigate, site });
				await assertHarnessIntact(page);
			} catch (e: any) {
				// the runner reports a failure without its test's name
				if (e instanceof Error) e.message = `[${name}] ${e.message}`;
				throw e;
			} finally {
				page.context().off("page", onPage);
				for (const p of extraPages) await p.close().catch(() => {});
				await page
					.evaluate(() => {
						for (const el of document.querySelectorAll(
							"iframe[data-extra-tab]"
						))
							el.remove();
					})
					.catch(() => {});
				await site.close();
			}
		},
	});
}

/**
 * The next window the context opens. Rejections are pre-handled: a test that
 * fails before awaiting it must not take the whole runner down with an
 * unhandled rejection when the context closes.
 */
function nextPopup(page: Page): Promise<Page> {
	const p = page.context().waitForEvent("page", { timeout: 8000 });
	p.catch(() => {});
	return p;
}

/** A link whose click is the thing under test: `#l` in the page. */
const LINK = (target: string, href: string) =>
	`<a id="l" target="${target}" href="${href}">go</a>`;

/**
 * Click `selector` in `frame` with a real input event - user activation is
 * part of whether a navigation is allowed to leave a frame, so a synthetic
 * `.click()` would test a different path.
 */
async function click(frame: Frame, selector = "#l") {
	await frame.click(selector, { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// the tests
// ---------------------------------------------------------------------------

/** The keywords that climb, in the spellings the rules accept. */
const CLIMB_TOP = ["_top", "_TOP", "_Top"];
const CLIMB_PARENT = ["_parent", "_PARENT", "_Parent"];

export default [
	// --- window.name, as the page reads it ----------------------------------

	nameTest(
		"framename-top-initially-empty",
		async ({ page, navigate, site }) => {
			site.page("/", "<p>top</p>");
			const t = await open(page, navigate, site.a + "/");
			// a top-level traversable nobody named has the empty string
			await assertNameInvisible(t, "", "fresh top-level");
		}
	),

	nameTest(
		"framename-subframe-initially-empty",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<iframe id="f" src="/child"></iframe><iframe id="g" src="/child2"></iframe>`
			);
			site.page("/child", "<p>child</p>");
			site.page("/child2", `<iframe src="/child3"></iframe>`);
			site.page("/child3", "<p>grandchild</p>");
			const t = await open(page, navigate, site.a + "/");
			const c = await child(t, "/child");
			const g = await child(await child(t, "/child2"), "/child3");
			await assertNameInvisible(c, "", "unnamed subframe");
			await assertNameInvisible(g, "", "unnamed grandchild");
			// nothing may have been written onto the page's own elements either
			const attrs = await pv(t, () => {
				const f = document.getElementById("f") as HTMLIFrameElement;
				return {
					attr: f.getAttribute("name"),
					has: f.hasAttribute("name"),
					idl: f.name,
					outer: f.outerHTML,
					contentName: f.contentWindow!.name,
					// the index a frame is reachable by is its own key natively; only a
					// name would add another
					named: Object.keys(window).filter(
						(k) => !/^\d+$/.test(k) && (window as any)[k] === f.contentWindow
					),
				};
			});
			assertEqual(
				attrs,
				{
					attr: null,
					has: false,
					idl: "",
					outer: '<iframe id="f" src="/child"></iframe>',
					contentName: "",
					named: [],
				},
				"the page's iframe element and its window"
			);
		}
	),

	nameTest(
		"framename-dynamic-iframe-empty",
		async ({ page, navigate, site }) => {
			site.page("/", "<p>top</p>");
			site.page("/child", "<p>child</p>");
			const t = await open(page, navigate, site.a + "/");
			const r = await pv(t, async () => {
				const out: any = {};
				// about:blank, reached before it has navigated
				const blank = document.createElement("iframe");
				document.body.appendChild(blank);
				out.blank = [blank.contentWindow!.name, blank.getAttribute("name")];
				// srcdoc
				const sd = document.createElement("iframe");
				sd.srcdoc = "<p>x</p>";
				document.body.appendChild(sd);
				await new Promise((r) => (sd.onload = r));
				out.srcdoc = [sd.contentWindow!.name, sd.getAttribute("name")];
				// a real document
				const f = document.createElement("iframe");
				f.src = "/child";
				document.body.appendChild(f);
				await new Promise((r) => (f.onload = r));
				out.src = [f.contentWindow!.name, f.getAttribute("name")];
				return out;
			});
			assertEqual(
				r,
				{ blank: ["", null], srcdoc: ["", null], src: ["", null] },
				"window.name and name attribute of page-made frames"
			);
		}
	),

	nameTest("framename-named-iframe", async ({ page, navigate, site }) => {
		site.page("/", `<iframe id="f" name="foo" src="/child"></iframe>`);
		site.page("/child", "<p>child</p>");
		const t = await open(page, navigate, site.a + "/");
		const c = await child(t, "/child");
		await assertNameInvisible(c, "foo", "the frame's name from its attribute");
		const r = await pv(t, () => {
			const f = document.getElementById("f") as HTMLIFrameElement;
			return {
				byFrames: (window.frames as any).foo === f.contentWindow,
				byWindow: (window as any).foo === f.contentWindow,
				inWindow: "foo" in window,
				open: window.open("", "foo") === f.contentWindow,
			};
		});
		assertEqual(
			r,
			{ byFrames: true, byWindow: true, inWindow: true, open: true },
			"the name as a named property and a window.open target"
		);
	}),

	nameTest("framename-set-in-top", async ({ page, navigate, site }) => {
		site.page("/", "<p>top</p>");
		const t = await open(page, navigate, site.a + "/");
		await pv(t, () => {
			window.name = "main";
		});
		await assertNameInvisible(t, "main", "after the top-level names itself");
		const r = await pv(t, () => {
			const out: any[] = [];
			// DOMString conversion, exactly as the IDL setter does it
			for (const v of [
				null,
				undefined,
				42,
				true,
				{ toString: () => "obj" },
				"",
				"a\u0000b",
				"\u{1F600}",
				"_top",
				"_blank",
			]) {
				window.name = v as any;
				out.push(window.name);
			}
			try {
				window.name = Symbol("s") as any;
				out.push("no throw");
			} catch (e: any) {
				out.push(e.constructor.name);
			}
			out.push(window.name);
			return out;
		});
		assertEqual(
			r,
			[
				"null",
				"undefined",
				"42",
				"true",
				"obj",
				"",
				"a\u0000b",
				"\u{1F600}",
				"_top",
				"_blank",
				"TypeError",
				"_blank",
			],
			"window.name conversions"
		);
	}),

	nameTest("framename-set-in-subframe", async ({ page, navigate, site }) => {
		site.page("/", `<iframe id="f" src="/child"></iframe>`);
		site.page("/child", "<p>child</p>");
		const t = await open(page, navigate, site.a + "/");
		const c = await child(t, "/child");
		await pv(c, () => {
			window.name = "renamed";
		});
		await assertNameInvisible(c, "renamed", "subframe after renaming itself");
		const r = await pv(t, () => {
			const f = document.getElementById("f") as HTMLIFrameElement;
			return {
				fromParent: f.contentWindow!.name,
				attr: f.getAttribute("name"),
				named: (window as any).renamed === f.contentWindow,
				open: window.open("", "renamed") === f.contentWindow,
			};
		});
		assertEqual(
			r,
			{ fromParent: "renamed", attr: null, named: true, open: true },
			"a subframe's own rename, seen from its parent"
		);
	}),

	nameTest(
		"framename-read-across-windows",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe id="f" name="kid" src="/child"></iframe>`);
			site.page("/child", "<p>child</p>");
			const t = await open(page, navigate, site.a + "/");
			await pv(t, () => {
				window.name = "parentname";
			});
			const c = await child(t, "/child");
			const r = await pv(c, () => {
				const get = Object.getOwnPropertyDescriptor(window, "name")!.get!;
				const set = Object.getOwnPropertyDescriptor(window, "name")!.set!;
				const out: any = {
					parent: parent.name,
					// this realm's getter against the parent window
					crossGetter: get.call(parent),
					parentsGetter: Object.getOwnPropertyDescriptor(
						parent,
						"name"
					)!.get!.call(window),
				};
				set.call(parent, "setFromChild");
				out.afterCrossSet = parent.name;
				return out;
			});
			assertEqual(
				r,
				{
					parent: "parentname",
					crossGetter: "parentname",
					parentsGetter: "kid",
					afterCrossSet: "setFromChild",
				},
				"window.name read and written across windows"
			);
			await assertNameInvisible(
				t,
				"setFromChild",
				"top after a child set its name"
			);
		}
	),

	// --- persistence of the emulated top-level's name -------------------------

	nameTest(
		"framename-top-persists-same-origin",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<script>window.name = "keep"; location.href = "/next";</script>`
			);
			site.page(
				"/next",
				`<script>report("next", { name: window.name })</script>`
			);
			await navigate(site.a + "/");
			assertEqual(
				(await site.waitHit("next")).name,
				"keep",
				"a same-origin navigation keeps the name"
			);
		}
	),

	nameTest(
		"framename-top-persists-link-and-form",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<script>window.name = "keep";</script>${LINK("", "/next")}`
			);
			site.page(
				"/next",
				`<script>report("next", { name: window.name })</script>
			<form id="f" action="/third"><button id="b">go</button></form>`
			);
			site.page(
				"/third",
				`<script>report("third", { name: window.name })</script>`
			);
			const t = await open(page, navigate, site.a + "/");
			await click(t);
			assertEqual((await site.waitHit("next")).name, "keep", "after a link");
			await click(await topFrame(page), "#b");
			assertEqual((await site.waitHit("third")).name, "keep", "after a form");
		}
	),

	nameTest(
		"framename-top-cleared-cross-origin",
		async ({ page, navigate, site }) => {
			// finalize a cross-document navigation, step 4: a top-level traversable
			// with no opener loses its name when the origin changes
			site.page(
				"/",
				`<script>window.name = "secret"; location.href = ${JSON.stringify(site.b + "/other")};</script>`
			);
			site.page(
				"/other",
				`<script>report("other", { name: window.name, origin: location.origin })</script>`
			);
			await navigate(site.a + "/");
			const r = await site.waitHit("other");
			assertEqual(
				r,
				{ name: "", origin: site.b },
				"cross-origin navigation clears the name"
			);
		}
	),

	nameTest(
		"framename-top-persists-reload",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<script>
			if (performance.getEntriesByType("navigation")[0].type === "reload") report("reloaded", { name: window.name });
			else { window.name = "kept"; location.reload(); }
		</script>`
			);
			await navigate(site.a + "/");
			assertEqual(
				(await site.waitHit("reloaded")).name,
				"kept",
				"a reload keeps the name"
			);
		}
	),

	nameTest(
		"framename-top-same-document-history",
		async ({ page, navigate, site }) => {
			site.page("/", "<p>top</p>");
			const t = await open(page, navigate, site.a + "/");
			const r = await pv(t, async () => {
				const out: string[] = [];
				window.name = "one";
				history.pushState(null, "", "/pushed");
				out.push(window.name);
				window.name = "two";
				location.hash = "frag";
				out.push(window.name);
				history.back();
				await new Promise((r) => setTimeout(r, 200));
				out.push(window.name);
				history.back();
				await new Promise((r) => setTimeout(r, 200));
				out.push(window.name);
				return out;
			});
			// same-document entries share one document state, so one name
			assertEqual(
				r,
				["one", "two", "two", "two"],
				"the name across same-document history"
			);
		}
	),

	nameTest(
		"framename-subframe-persists-cross-origin",
		async ({ page, navigate, site }) => {
			// a child navigable has a parent, so step 4 never clears it
			site.page("/", `<iframe id="f" src="/child"></iframe>`);
			site.page(
				"/child",
				`<script>window.name = "sticky"; location.href = ${JSON.stringify(site.b + "/far")};</script>`
			);
			site.page(
				"/far",
				`<script>report("far", { name: window.name, origin: location.origin })</script>`
			);
			await navigate(site.a + "/");
			assertEqual(
				await site.waitHit("far"),
				{ name: "sticky", origin: site.b },
				"a subframe keeps its name across origins"
			);
		}
	),

	// --- keyword targets from the emulated top-level -------------------------

	...[...CLIMB_TOP, ...CLIMB_PARENT].map((kw) =>
		nameTest(`framename-top-link-${kw}`, async ({ page, navigate, site }) => {
			// from the top-level both climb nowhere: they are the top itself
			site.page("/", LINK(kw, "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			await click(t);
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the test frame navigated"
			);
		})
	),

	...["_top", "_parent"].map((kw) =>
		nameTest(`framename-top-form-${kw}`, async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<form id="f" target="${kw}" action="/land/hit"><button id="b">go</button></form>`
			);
			const t = await open(page, navigate, site.a + "/");
			await click(t, "#b");
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the test frame navigated"
			);
		})
	),

	...["_top", "_parent"].map((kw) =>
		nameTest(
			`framename-top-formtarget-${kw}`,
			async ({ page, navigate, site }) => {
				site.page(
					"/",
					`<form action="/land/wrong">
				<button id="b" formtarget="${kw}" formaction="/land/hit">go</button>
				<input id="i" type="submit" formtarget="${kw}" formaction="/land/hit2">
			</form>`
				);
				let t = await open(page, navigate, site.a + "/");
				await click(t, "#b");
				await site.waitHit("hit");
				await assertHarnessIntact(page);
				t = await open(page, navigate, site.a + "/");
				await click(t, "#i");
				await site.waitHit("hit2");
				await assertHarnessIntact(page);
				assertEqual(
					await pathOf(await topFrame(page)),
					"/land/hit2",
					"the test frame navigated"
				);
			}
		)
	),

	...["_top", "_parent"].map((kw) =>
		nameTest(
			`framename-top-base-target-${kw}`,
			async ({ page, navigate, site }) => {
				site.page(
					"/",
					`<base target="${kw}"><a id="l" href="/land/hit">go</a>`
				);
				const t = await open(page, navigate, site.a + "/");
				await click(t);
				await site.waitHit("hit");
				await assertHarnessIntact(page);
				assertEqual(
					await pathOf(await topFrame(page)),
					"/land/hit",
					"the test frame navigated"
				);
			}
		)
	),

	// a keyword that means this frame is `_self`, not a missing target: the
	// form's own target, or the base element's, would take over from it
	nameTest(
		"framename-top-keyword-keeps-precedence",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<iframe name="receipt"></iframe>
			<form target="receipt" action="/land/form"><button id="b" formtarget="_top">pay</button></form>`
			);
			let t = await open(page, navigate, site.a + "/");
			await click(t, "#b");
			await site.waitHit("form");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/form",
				"formtarget _top over the form's target"
			);

			site.page(
				"/base",
				`<base target="_blank"><a id="l" href="/land/link">go</a>`
			);
			t = await open(page, navigate, site.a + "/base");
			await pv(t, () => {
				(document.getElementById("l") as HTMLAnchorElement).target = "_parent";
			});
			await click(t);
			await site.waitHit("link");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/link",
				"_parent over the base target"
			);
		}
	),

	// a target a script wrote before the page renamed its window still means
	// the window
	nameTest(
		"framename-top-renamed-after-dynamic-target",
		async ({ page, navigate, site }) => {
			site.page("/", `<a id="l" href="/land/hit">go</a>`);
			const t = await open(page, navigate, site.a + "/");
			await pv(t, () => {
				(document.getElementById("l") as HTMLAnchorElement).target = "_top";
				window.name = "renamed";
			});
			await click(t);
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the top-level navigated"
			);
		}
	),

	// `noopener` makes a target a lookup by name, which a keyword is not
	nameTest(
		"framename-top-window-open-noopener",
		async ({ page, navigate, site }) => {
			site.page("/", `<p>top</p>`);
			const t = await open(page, navigate, site.a + "/");
			await pv(t, () => {
				window.open("/land/hit", "_top", "noopener");
			});
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the top-level navigated"
			);
		}
	),

	nameTest("framename-top-area-and-svg", async ({ page, navigate, site }) => {
		site.page(
			"/",
			`
			<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" usemap="#m" width="50" height="50" id="img">
			<map name="m"><area id="area" shape="rect" coords="0,0,50,50" href="/land/area" target="_top"></map>
			<svg width="50" height="50"><a id="svga" href="/land/svg" target="_parent"><rect width="50" height="50"/></a></svg>`
		);
		let t = await open(page, navigate, site.a + "/");
		await click(t, "#img");
		await site.waitHit("area");
		await assertHarnessIntact(page);
		t = await open(page, navigate, site.a + "/");
		await click(t, "#svga rect");
		await site.waitHit("svg");
		await assertHarnessIntact(page);
	}),

	nameTest(
		"framename-top-dynamic-targets",
		async ({ page, navigate, site }) => {
			// written after load, through every path that sets the attribute
			site.page("/", `<div id="host"></div>`);
			const paths = [
				`a => { a.target = "_top"; }`,
				`a => { a.setAttribute("target", "_parent"); }`,
				`a => { a.setAttributeNS(null, "target", "_TOP"); }`,
				`a => { const at = document.createAttribute("target"); at.value = "_top"; a.setAttributeNode(at); }`,
				`a => { a.target = "x"; a.getAttributeNode("target").value = "_parent"; }`,
				`a => { a.target = "x"; a.attributes.target.nodeValue = "_top"; }`,
			];
			for (let i = 0; i < paths.length; i++) {
				const t = await open(page, navigate, site.a + "/");
				await pv(
					t,
					([fn, i]) => {
						const a = document.createElement("a");
						a.id = "l";
						a.href = "/land/dyn" + i;
						a.textContent = "go";
						(0, eval)(fn)(a);
						document.getElementById("host")!.appendChild(a);
					},
					[paths[i], i] as const
				);
				await click(t);
				await site.waitHit("dyn" + i);
				await assertHarnessIntact(page);
			}
			// and through markup
			for (const [i, markup] of [
				'<a id="l" target="_top" href="/land/m0">go</a>',
				'<a id="l" target="_parent" href="/land/m1">go</a>',
			].entries()) {
				const t = await open(page, navigate, site.a + "/");
				await pv(
					t,
					(m) => {
						document.getElementById("host")!.innerHTML = m;
					},
					markup
				);
				await click(t);
				await site.waitHit("m" + i);
				await assertHarnessIntact(page);
			}
			const t = await open(page, navigate, site.a + "/");
			await pv(t, () => {
				document
					.getElementById("host")!
					.insertAdjacentHTML(
						"beforeend",
						'<form id="f" target="_top" action="/land/m2"><button id="b">go</button></form>'
					);
			});
			await click(t, "#b");
			await site.waitHit("m2");
		}
	),

	nameTest(
		"framename-top-scripted-submit",
		async ({ page, navigate, site }) => {
			// form.submit() fires no submit event and needs no user activation
			site.page(
				"/",
				`<form id="f" target="_parent" action="/land/sub"></form>
			<script>setTimeout(() => document.getElementById("f").submit(), 50)</script>`
			);
			await navigate(site.a + "/");
			await site.waitHit("sub");
			await assertHarnessIntact(page);
			site.page(
				"/2",
				`<form id="f" target="_top" action="/land/req"><button>x</button></form>
			<script>setTimeout(() => document.getElementById("f").requestSubmit(), 50)</script>`
			);
			await navigate(site.a + "/2");
			await site.waitHit("req");
			await assertHarnessIntact(page);
		}
	),

	nameTest(
		"framename-top-window-open-keywords",
		async ({ page, navigate, site }) => {
			site.page("/", "<p>top</p>");
			// not "": an empty target is `_blank`
			for (const [i, kw] of ["_top", "_parent", "_TOP", "_self"].entries()) {
				const t = await open(page, navigate, site.a + "/");
				const same = await pv(
					t,
					([kw, i]) => window.open("/land/w" + i, kw as string) === window,
					[kw, i] as const
				);
				assertEqual(
					same,
					true,
					`window.open(url, ${JSON.stringify(kw)}) returns the top-level itself`
				);
				await site.waitHit("w" + i);
				await assertHarnessIntact(page);
			}
			// the three-argument document.open is window.open under another name
			const t = await open(page, navigate, site.a + "/");
			const same = await pv(
				t,
				() => document.open("/land/dopen", "_parent", "") === window
			);
			assertEqual(
				same,
				true,
				"document.open(url, '_parent', '') returns the top-level"
			);
			await site.waitHit("dopen");
		}
	),

	// --- keyword targets from subframes ---------------------------------------

	...CLIMB_TOP.map((kw) =>
		nameTest(`framename-child-link-${kw}`, async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", LINK(kw, "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the top-level navigated"
			);
		})
	),

	...CLIMB_PARENT.map((kw) =>
		nameTest(`framename-child-link-${kw}`, async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", LINK(kw, "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the parent (the top-level) navigated"
			);
		})
	),

	// a link around a custom element, clicked on what its shadow root renders
	nameTest(
		"framename-child-link-around-shadow-content",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page(
				"/child",
				`<a target="_top" href="/land/hit"><x-label></x-label></a>
			<script>customElements.define("x-label", class extends HTMLElement {
				constructor() {
					super();
					this.attachShadow({ mode: "open" }).innerHTML = '<span style="display:inline-block;width:60px;height:20px">go</span>';
				}
			});</script>`
			);
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"), "x-label");
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the top-level navigated"
			);
		}
	),

	// an empty target is none: the base element's applies
	nameTest(
		"framename-child-empty-target-uses-base",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", `<base target="_parent">${LINK("", "/land/hit")}`);
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the parent (the top-level) navigated"
			);
		}
	),

	nameTest(
		"framename-grandchild-parent-is-middle",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/mid"></iframe>`);
			site.page("/mid", `<iframe src="/leaf"></iframe>`);
			site.page(
				"/leaf",
				LINK("_parent", "/land/hit") +
					`<form id="f" target="_parent" action="/land/form"><button id="b">x</button></form>`
			);
			let t = await open(page, navigate, site.a + "/");
			await click(await child(await child(t, "/mid"), "/leaf"));
			await site.waitHit("hit");
			t = await topFrame(page);
			assertEqual(await pathOf(t), "/", "the top-level stayed put");
			await child(t, "/land/hit");
			// and a form, and window.open
			t = await open(page, navigate, site.a + "/");
			await click(await child(await child(t, "/mid"), "/leaf"), "#b");
			await site.waitHit("form");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"the top-level stayed put for the form"
			);
			t = await open(page, navigate, site.a + "/");
			const leaf = await child(await child(t, "/mid"), "/leaf");
			const r = await pv(
				leaf,
				() => window.open("/land/wo", "_parent") === parent
			);
			assertEqual(
				r,
				true,
				"window.open(url, '_parent') returns the middle frame"
			);
			await site.waitHit("wo");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"the top-level stayed put for window.open"
			);
		}
	),

	nameTest(
		"framename-child-targets-after-load",
		async ({ page, navigate, site }) => {
			// once the served HTML has arrived nothing watches the document; what
			// script adds later has to be right as it is written
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", `<div id="host"></div>`);
			const paths = [
				`h => { h.innerHTML = '<a id="l" target="_top" href="/land/a0">x</a>'; }`,
				`h => { const a = document.createElement("a"); a.id = "l"; a.href = "/land/a1"; a.textContent = "x"; a.setAttribute("target", "_top"); h.append(a); }`,
				`h => { const a = document.createElement("a"); a.id = "l"; a.href = "/land/a2"; a.textContent = "x"; h.append(a); a.target = "_parent"; }`,
				`h => { h.insertAdjacentHTML("beforeend", '<form target="_top" action="/land/a3"><button id="l">x</button></form>'); }`,
				`h => { h.insertAdjacentHTML("beforeend", '<form action="/land/a4"><button id="l" formtarget="_parent">x</button></form>'); }`,
				`h => { const t = document.createElement("template"); t.innerHTML = '<a id="l" target="_top" href="/land/a5">x</a>'; h.append(t.content.cloneNode(true)); }`,
				`h => { const d = new DOMParser().parseFromString('<a id="l" target="_top" href="/land/a6">x</a>', "text/html"); h.append(document.adoptNode(d.body.firstChild)); }`,
			];
			for (let i = 0; i < paths.length; i++) {
				const t = await open(page, navigate, site.a + "/");
				const c = await child(t, "/child");
				await pv(
					c,
					(fn) => (0, eval)(fn)(document.getElementById("host")),
					paths[i]
				);
				await click(c);
				await site.waitHit("a" + i);
				await assertHarnessIntact(page);
				assertEqual(
					await pathOf(await topFrame(page)),
					"/land/a" + i,
					`path ${i}: the top-level navigated`
				);
			}
		}
	),

	...(
		[
			["plain", `<a id="l" target="_top" href="/land/HIT">go</a>`],
			[
				"foster-parented",
				`<table><a id="l" target="_top" href="/land/HIT">go</a><tr><td>cell</td></tr></table>`,
			],
			[
				"form in table",
				`<table><form target="_top" action="/land/HIT"><tr><td><button id="l">go</button></td></tr></form></table>`,
			],
			[
				"void input",
				`<form action="/land/wrong"><input id="l" type="submit" formtarget="_top" formaction="/land/HIT"></form>`,
			],
			[
				"area",
				`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" usemap="#m" width="40" height="40" id="l"><map name="m"><area shape="rect" coords="0,0,40,40" target="_top" href="/land/HIT"></map>`,
			],
			[
				"svg",
				`<svg width="40" height="40"><a target="_top" href="/land/HIT"><rect id="l" width="40" height="40"/></a></svg>`,
			],
			[
				"base in head",
				`<a id="l" href="/land/HIT">go</a>`,
				`<base target="_top">`,
			],
			[
				"nested in form",
				`<form target="_top" action="/land/wrong"><a id="l" target="_top" href="/land/HIT">go</a></form>`,
			],
			[
				"declarative shadow",
				`<div id="h"><template shadowrootmode="open"><a id="l" target="_top" href="/land/HIT">go</a></template></div>`,
			],
			[
				"template clone",
				`<template id="tp"><a id="l" target="_top" href="/land/HIT">go</a></template>
			<script>document.body.append(document.getElementById("tp").content.cloneNode(true))</script>`,
			],
			[
				"many",
				Array.from(
					{ length: 300 },
					(_, i) => `<a target="_top" href="/land/n${i}">${i}</a>`
				).join("") + `<a id="l" target="_top" href="/land/HIT">go</a>`,
			],
		] as const
	).map(([what, body, head], i) =>
		nameTest(
			`framename-served-placement-${what.replace(/ /g, "-")}`,
			async ({ page, navigate, site }) => {
				// the served subframe's targets are settled by the script the rewriter
				// puts after each; these are the places the parser might put either
				const id = "p" + i;
				site.page(
					"/",
					`<iframe src="/child" style="width:400px;height:300px"></iframe>`
				);
				const html = `<!doctype html><html><head><script>${REPORT_JS}</script>${head ?? ""}</head><body>${body.replace(/HIT/g, id)}</body></html>`;
				// served whole, not through the page wrapper, so the head is ours
				site.raw("/child", html);
				const t = await open(page, navigate, site.a + "/");
				const c = await child(t, "/child");
				await c.waitForSelector("#l");
				await click(c);
				await site.waitHit(id);
				await assertHarnessIntact(page);
				assertEqual(
					await pathOf(await topFrame(page)),
					"/land/" + id,
					`${what}: the top-level navigated`
				);
			}
		)
	),

	nameTest("framename-grandchild-top", async ({ page, navigate, site }) => {
		site.page("/", `<iframe src="/mid"></iframe>`);
		site.page("/mid", `<iframe src="/leaf"></iframe>`);
		site.page("/leaf", LINK("_top", "/land/hit"));
		const t = await open(page, navigate, site.a + "/");
		const leaf = await child(await child(t, "/mid"), "/leaf");
		const r = await pv(leaf, () => {
			// \`parent.parent\` rather than \`top\`, which is not what this is testing
			const w = window.open("", "_top");
			return w === parent.parent;
		});
		assertEqual(
			r,
			true,
			"window.open('', '_top') from two levels down returns the top-level"
		);
		await click(leaf);
		await site.waitHit("hit");
		await assertHarnessIntact(page);
		assertEqual(
			await pathOf(await topFrame(page)),
			"/land/hit",
			"the top-level navigated"
		);
	}),

	nameTest(
		"framename-child-anchors-after-it-navigates",
		async ({ page, navigate, site }) => {
			// the subframe's second document arrived by a link, not by the parent's
			// src attribute - its targets must work all the same
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", LINK("", "/child2"));
			site.page(
				"/child2",
				`<a id="t" target="_top" href="/land/top">t</a><a id="p" target="_parent" href="/land/parent">p</a>`
			);
			let t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await click(await child(await topFrame(page), "/child2"), "#t");
			await site.waitHit("top");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/top",
				"_top after an in-frame navigation"
			);
			t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await click(await child(await topFrame(page), "/child2"), "#p");
			await site.waitHit("parent");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/parent",
				"_parent after an in-frame navigation"
			);
		}
	),

	nameTest(
		"framename-child-anchors-cross-origin",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="${site.b}/child"></iframe>`);
			site.page("/child", `<a id="t" target="_top" href="/land/top">t</a>`);
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"), "#t");
			const r = await site.waitHit("top");
			assertEqual(r.origin, site.b, "landed on the frame's origin");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/top",
				"the top-level navigated"
			);
		}
	),

	nameTest("framename-srcdoc-targets", async ({ page, navigate, site }) => {
		site.page(
			"/",
			`<iframe id="f"></iframe><script>
			document.getElementById("f").srcdoc = '<a id="t" target="_top" href="/land/top">t</a><a id="p" target="_parent" href="/land/parent">p</a>';
		</script>`
		);
		let t = await open(page, navigate, site.a + "/");
		let sd = await waitFor(async () => t.childFrames()[0], "the srcdoc frame");
		await sd.waitForSelector("#t");
		await click(sd, "#t");
		await site.waitHit("top");
		await assertHarnessIntact(page);
		t = await open(page, navigate, site.a + "/");
		sd = await waitFor(async () => t.childFrames()[0], "the srcdoc frame");
		await sd.waitForSelector("#p");
		await click(sd, "#p");
		await site.waitHit("parent");
		await assertHarnessIntact(page);
		assertEqual(
			await pathOf(await topFrame(page)),
			"/land/parent",
			"_parent from a srcdoc child is the top-level"
		);
	}),

	nameTest(
		"framename-srcdoc-in-grandchild",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe src="/mid"></iframe>`);
			site.page(
				"/mid",
				`<iframe srcdoc='<a id="p" target="_parent" href="/land/p">p</a>'></iframe>`
			);
			const t = await open(page, navigate, site.a + "/");
			const mid = await child(t, "/mid");
			const sd = await waitFor(async () => mid.childFrames()[0], "srcdoc");
			await sd.waitForSelector("#p");
			await click(sd, "#p");
			await site.waitHit("p");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"the top-level stayed put"
			);
		}
	),

	nameTest(
		"framename-document-write-targets",
		async ({ page, navigate, site }) => {
			site.page("/", `<iframe id="f" src="/mid"></iframe>`);
			site.page(
				"/mid",
				`<iframe id="g"></iframe><script>
			const d = document.getElementById("g").contentDocument;
			d.open(); d.write('<a id="p" target="_parent" href="/land/p">p</a><a id="t" target="_top" href="/land/t">t</a>'); d.close();
		</script>`
			);
			let t = await open(page, navigate, site.a + "/");
			let w = await waitFor(
				async () => (await child(t, "/mid")).childFrames()[0],
				"written frame"
			);
			await click(w, "#p");
			await site.waitHit("p");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"_parent in the written grandchild is the middle frame"
			);
			t = await open(page, navigate, site.a + "/");
			w = await waitFor(
				async () => (await child(t, "/mid")).childFrames()[0],
				"written frame"
			);
			await click(w, "#t");
			await site.waitHit("t");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/t",
				"_top in the written grandchild"
			);
		}
	),

	// --- names the page chose ---------------------------------------------------

	nameTest("framename-named-frame-target", async ({ page, navigate, site }) => {
		site.page(
			"/",
			`<iframe name="content" src="/child"></iframe>${LINK("content", "/land/hit")}
			<form id="f" target="content" action="/land/form"><button id="b">x</button></form>`
		);
		site.page("/child", "<p>child</p>");
		let t = await open(page, navigate, site.a + "/");
		await click(t);
		await site.waitHit("hit");
		t = await topFrame(page);
		assertEqual(await pathOf(t), "/", "the top-level stayed put");
		await child(t, "/land/hit");
		await click(t, "#b");
		await site.waitHit("form");
		await child(t, "/land/form");
	}),

	nameTest(
		"framename-target-frame-created-later",
		async ({ page, navigate, site }) => {
			// the link was parsed long before any frame had the name; the browser
			// looks the name up when it is followed, and finds the one made since
			site.page("/", `<iframe src="/child"></iframe>`);
			site.page("/child", `<a id="l" target="later" href="/land/hit">go</a>`);
			site.page("/other", "<p>other</p>");
			const t = await open(page, navigate, site.a + "/");
			const c = await child(t, "/child");
			await pv(t, () => {
				const f = document.createElement("iframe");
				f.name = "later";
				f.src = "/other";
				document.body.appendChild(f);
			});
			await child(t, "/other");
			let popup = false;
			page.context().once("page", () => {
				popup = true;
			});
			await click(c);
			await site.waitHit("hit");
			assertEqual(popup, false, "no new window was opened");
			await child(t, "/land/hit");
			await child(t, "/child");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"the top-level stayed put"
			);
		}
	),

	nameTest(
		"framename-target-popup-opened-later",
		async ({ page, navigate, site }) => {
			site.page("/", `<a id="l" target="laterpop" href="/land/hit">go</a>`);
			site.page("/pop", "<p>popup</p>");
			const t = await open(page, navigate, site.a + "/");
			let popupP = nextPopup(page);
			await pv(t, () => {
				window.open("/pop", "laterpop");
			});
			const popup = await popupP;
			await popup.waitForLoadState();
			let extra = false;
			page.context().once("page", () => {
				extra = true;
			});
			await click(t);
			await site.waitHit("hit");
			await waitFor(
				async () => (await pathOf(popup.mainFrame())) === "/land/hit",
				"the popup navigated"
			);
			assertEqual(extra, false, "the existing popup was reused");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/",
				"the top-level stayed put"
			);
		}
	),

	nameTest(
		"framename-sibling-targets-by-name",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<iframe name="left" src="/left"></iframe><iframe name="right" src="/right"></iframe>`
			);
			site.page("/left", LINK("right", "/land/hit"));
			site.page("/right", "<p>right</p>");
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/left"));
			await site.waitHit("hit");
			await child(t, "/land/hit");
			await child(t, "/left");
		}
	),

	nameTest(
		"framename-top-name-does-not-break-top-target",
		async ({ page, navigate, site }) => {
			// whatever the page calls itself, `_top` must still mean the top-level
			for (const [i, n] of ["main", "", "x".repeat(5000)].entries()) {
				site.page(
					"/" + i,
					`<script>window.name = ${JSON.stringify(n)}</script><iframe src="/child${i}"></iframe>`
				);
				site.page("/child" + i, LINK("_top", "/land/hit" + i));
				const t = await open(page, navigate, site.a + "/" + i);
				await click(await child(t, "/child" + i));
				await site.waitHit("hit" + i);
				await assertHarnessIntact(page);
				assertEqual(
					await pathOf(await topFrame(page)),
					"/land/hit" + i,
					`_top with the top named ${JSON.stringify(n.slice(0, 10))}`
				);
			}
		}
	),

	// known failure: a name that starts with `_` is no target name, so with the
	// page's name as the frame's real one, `_top` from below has nothing to say
	nameTest(
		"framename-top-named-like-a-keyword",
		async ({ page, navigate, site }) => {
			site.page(
				"/",
				`<script>window.name = "_top"</script><iframe src="/child"></iframe>`
			);
			site.page("/child", LINK("_top", "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			await click(await child(t, "/child"));
			await site.waitHit("hit");
			await assertHarnessIntact(page);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"_top with the top named _top"
			);
		}
	),

	nameTest(
		"framename-child-named-like-top-target",
		async ({ page, navigate, site }) => {
			// a page can pick any name for its own frame; none of them may capture
			// the top-level's navigations
			site.page("/", `<iframe name="evil" src="/child"></iframe>`);
			site.page(
				"/child",
				`<script>
			// try names a proxy might plausibly use for the top-level
			for (const n of ["top", "_top", "sj-top", "scramjet-top", "scramjet", "__top", "main"]) window.name = n;
		</script><iframe src="/leaf"></iframe>`
			);
			site.page("/leaf", LINK("_top", "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			await click(await child(await child(t, "/child"), "/leaf"));
			await site.waitHit("hit");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the top-level navigated, not the frame"
			);
		}
	),

	// --- the page cannot see how targets were rewritten -----------------------

	nameTest("framename-target-reflection", async ({ page, navigate, site }) => {
		site.page(
			"/",
			`
			<base id="base" target="_parent">
			<a id="a" target="_top" href="/x">a</a>
			<a id="a2" target="_Parent" href="/x">a</a>
			<map name="m"><area id="area" target="_top" href="/x"></map>
			<form id="form" target="_parent" action="/x">
				<button id="btn" formtarget="_top">b</button>
				<input id="inp" type="submit" formtarget="_parent">
			</form>
			<svg><a id="svga" target="_top" href="/x"><text>s</text></a></svg>
			<iframe src="/child"></iframe>`
		);
		site.page(
			"/child",
			`<a id="a" target="_top" href="/x">a</a><a id="p" target="_parent" href="/x">p</a>`
		);
		const check = () => {
			const $ = (id: string) => document.getElementById(id) as any;
			const out: any = {};
			for (const [id, attr, prop] of [
				["base", "target", "target"],
				["a", "target", "target"],
				["a2", "target", "target"],
				["area", "target", "target"],
				["form", "target", "target"],
				["btn", "formtarget", "formTarget"],
				["inp", "formtarget", "formTarget"],
				["p", "target", "target"],
			] as const) {
				const el = $(id);
				if (!el) continue;
				out[id] = [
					el.getAttribute(attr),
					el[prop],
					el.getAttributeNode(attr)?.value,
					el.attributes[attr]?.value,
				];
			}
			const s = $("svga");
			if (s)
				out.svga = [
					s.getAttribute("target"),
					s.target.baseVal,
					s.target.animVal,
				];
			out.markup =
				document.body.innerHTML.includes("scramjet") ||
				/target="(?!_top"|_parent"|_Parent")[^"]*"/i.test(
					document.body.innerHTML.replace(/formtarget/g, "target")
				);
			out.selectors = [
				document.querySelectorAll('[target="_top"]').length,
				document.querySelectorAll('[target="_parent"]').length,
				document.querySelectorAll('[formtarget="_top"]').length,
				!!document
					.querySelector('a[target="_top"]')
					?.matches('[target="_top"]'),
			];
			out.attrNames = [...document.querySelectorAll("*")]
				.flatMap((e) => e.getAttributeNames())
				.filter((n) => n.includes("scramjet"));
			return out;
		};
		const t = await open(page, navigate, site.a + "/");
		const r = await pv(t, check);
		assertEqual(
			r,
			{
				base: ["_parent", "_parent", "_parent", "_parent"],
				a: ["_top", "_top", "_top", "_top"],
				a2: ["_Parent", "_Parent", "_Parent", "_Parent"],
				area: ["_top", "_top", "_top", "_top"],
				form: ["_parent", "_parent", "_parent", "_parent"],
				btn: ["_top", "_top", "_top", "_top"],
				inp: ["_parent", "_parent", "_parent", "_parent"],
				svga: ["_top", "_top", "_top"],
				markup: false,
				selectors: [3, 2, 1, true],
				attrNames: [],
			},
			"every reflection of a rewritten target in the top-level"
		);
		const c = await child(t, "/child");
		const rc = await pv(c, check);
		assertEqual(rc.a, ["_top", "_top", "_top", "_top"], "in a subframe");
		assertEqual(
			rc.p,
			["_parent", "_parent", "_parent", "_parent"],
			"in a subframe"
		);
		assertEqual(rc.markup, false, "subframe markup");
	}),

	nameTest(
		"framename-top-no-mutation-records",
		async ({ page, navigate, site }) => {
			// the top-level document is the one every site has, and nothing about
			// its targets needs changing after it is parsed - an observer the page
			// set up first sees only the parser's own insertions
			site.page(
				"/",
				`<script>
			window.__records = [];
			new MutationObserver((rs) => {
				for (const r of rs) if (r.type === "attributes") window.__records.push(r.attributeName);
			}).observe(document, { attributes: true, subtree: true, attributeOldValue: true });
		</script>
		<base target="_parent">
		<a target="_top" href="/x">a</a><a target="_parent" href="/x">b</a><a target="_blank" href="/x">c</a>
		<form target="_top"><button formtarget="_parent">x</button></form>
		<area target="_top" href="/x">`
			);
			const t = await open(page, navigate, site.a + "/");
			await sleep(200);
			assertEqual(
				await pv(t, () => (window as any).__records),
				[],
				"attribute mutation records"
			);
		}
	),

	// --- more than one tab in the same embedder ----------------------------------

	nameTest(
		"framename-two-tabs-top-target",
		async ({ page, navigate, site }) => {
			// a second emulated top-level beside the test frame. `_top` from inside
			// either one must reach its own top-level, never the other tab
			site.page("/tab", `<iframe src="/child"></iframe>`);
			site.page("/child", LINK("_top", "/land/hit"));
			site.page("/other", "<p>other tab</p>");
			await page.evaluate(() => {
				const el = document.createElement("iframe");
				el.id = "tab2";
				el.dataset.extraTab = "1";
				document.getElementById("testframe")!.before(el);
				(window as any).__tab2 = (window as any).__runwayController.createFrame(
					el
				);
			});
			// tab2 sits *before* the test frame in the document, so it is the first
			// frame a by-name search of the embedder meets
			await page.evaluate((u) => (window as any).__tab2.go(u), site.a + "/tab");
			await navigate(site.a + "/tab");
			const t = await waitFor(async () => {
				const f = await topFrame(page);
				return (await pathOf(f)) === "/tab" ? f : null;
			}, "tab 1");
			const t2 = await waitFor(async () => {
				const f = await topFrame(page, "#tab2");
				return (await pathOf(f)) === "/tab" ? f : null;
			}, "tab 2");
			await child(t2, "/child");
			await click(await child(t, "/child"));
			await site.waitHit("hit");
			await sleep(300);
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the tab whose frame was clicked navigated"
			);
			assertEqual(
				await pathOf(await topFrame(page, "#tab2")),
				"/tab",
				"the other tab did not"
			);
		}
	),

	nameTest(
		"framename-two-tabs-names-independent",
		async ({ page, navigate, site }) => {
			site.page("/", "<p>tab</p>");
			await page.evaluate(() => {
				const el = document.createElement("iframe");
				el.id = "tab2";
				el.dataset.extraTab = "1";
				document.body.appendChild(el);
				(window as any).__tab2 = (window as any).__runwayController.createFrame(
					el
				);
			});
			await page.evaluate((u) => (window as any).__tab2.go(u), site.a + "/");
			const t = await open(page, navigate, site.a + "/");
			const t2 = await waitFor(async () => {
				const f = await topFrame(page, "#tab2");
				return (await pathOf(f)) === "/" ? f : null;
			}, "tab 2");
			await pv(t, () => {
				window.name = "one";
			});
			await assertNameInvisible(t2, "", "the other tab");
			await pv(t2, () => {
				window.name = "two";
			});
			await assertNameInvisible(t, "one", "the first tab");
			// separate tabs are not familiar with each other: neither finds the other
			// by name
			const r = await pv(t, () => {
				const w = window.open("", "two");
				const found =
					w !== null && w.name === "two" && w.location.href !== "about:blank";
				w?.close();
				return found;
			});
			assertEqual(r, false, "one tab cannot reach the other by name");
		}
	),

	// --- popups: real top-level traversables -----------------------------------

	nameTest("framename-popup-names", async ({ page, navigate, site }) => {
		site.page("/", `<script>window.name = "opener-name"</script>`);
		site.page(
			"/popup",
			`<script>report("popup", { name: window.name, openerName: opener && opener.name })</script>`
		);
		const t = await open(page, navigate, site.a + "/");
		const popupP = nextPopup(page);
		const r = await pv(t, () => {
			const w = window.open("/popup", "pop");
			return { name: w!.name, again: window.open("", "pop") === w };
		});
		await popupP;
		assertEqual(
			r,
			{ name: "pop", again: true },
			"the popup is named, and found by its name"
		);
		assertEqual(
			await site.waitHit("popup"),
			{ name: "pop", openerName: "opener-name" },
			"the popup's own name, and its opener's"
		);
	}),

	nameTest(
		"framename-popup-targets-opener-by-name",
		async ({ page, navigate, site }) => {
			// the classic pattern: a popup loads its links into the window that opened it
			site.page("/", `<script>window.name = "main"</script>`);
			site.page("/popup", LINK("main", "/land/hit"));
			const t = await open(page, navigate, site.a + "/");
			const popupP = nextPopup(page);
			await pv(t, () => {
				window.open("/popup", "helper");
			});
			const popup = await popupP;
			await popup.waitForLoadState();
			await popup.click("#l");
			await site.waitHit("hit");
			assertEqual(
				await pathOf(await topFrame(page)),
				"/land/hit",
				"the opener's tab navigated"
			);
			assertEqual(
				await pathOf(popup.mainFrame()),
				"/popup",
				"the popup stayed put"
			);
		}
	),

	nameTest("framename-popup-subframe-top", async ({ page, navigate, site }) => {
		// inside a real popup `_top` is that popup - not the tab that opened it
		site.page("/", "<p>opener</p>");
		site.page("/popup", `<iframe src="/child"></iframe>`);
		site.page(
			"/child",
			`<a id="t" target="_top" href="/land/t">t</a><a id="p" target="_parent" href="/land/p">p</a>`
		);
		const t = await open(page, navigate, site.a + "/");
		let popupP = nextPopup(page);
		await pv(t, () => {
			window.open("/popup", "_blank");
		});
		let popup = await popupP;
		await popup.waitForLoadState();
		let c = await child(popup.mainFrame(), "/child");
		await click(c, "#t");
		await site.waitHit("t");
		await waitFor(
			async () => (await pathOf(popup.mainFrame())) === "/land/t",
			"the popup navigated"
		);
		assertEqual(
			await pathOf(await topFrame(page)),
			"/",
			"the opener's tab stayed put"
		);
		// and `_parent`
		popupP = nextPopup(page);
		await pv(t, () => {
			window.open("/popup", "_blank");
		});
		popup = await popupP;
		await popup.waitForLoadState();
		c = await child(popup.mainFrame(), "/child");
		await click(c, "#p");
		await site.waitHit("p");
		await waitFor(
			async () => (await pathOf(popup.mainFrame())) === "/land/p",
			"the popup navigated"
		);
		assertEqual(
			await pathOf(await topFrame(page)),
			"/",
			"the opener's tab stayed put"
		);
	}),

	nameTest("framename-link-blank-popup", async ({ page, navigate, site }) => {
		site.page(
			"/",
			LINK("_blank", "/popup") +
				`<a id="n" target="newwin" href="/popup2">n</a>`
		);
		site.page(
			"/popup",
			`<script>report("popup", { name: window.name })</script>`
		);
		site.page(
			"/popup2",
			`<script>report("popup2", { name: window.name })</script>`
		);
		const t = await open(page, navigate, site.a + "/");
		await click(t);
		assertEqual(
			await site.waitHit("popup"),
			{ name: "" },
			"a _blank popup is unnamed"
		);
		await click(t, "#n");
		assertEqual(
			await site.waitHit("popup2"),
			{ name: "newwin" },
			"a popup named by the link's target"
		);
		assertEqual(await pathOf(await topFrame(page)), "/", "the tab stayed put");
	}),

	// --- the same in both harnesses: nothing here depends on being top-level ----

	basicTest({
		name: "framename-descriptor-shape",
		js: `
			const d = Object.getOwnPropertyDescriptor(window, "name");
			assert(d, "an own property of the window");
			assertEqual(typeof d.get, "function", "getter");
			assertEqual(typeof d.set, "function", "setter");
			assertEqual(d.enumerable, true, "enumerable");
			assertEqual(d.configurable, true, "configurable");
			assertEqual(d.get.name, "get name", "getter name");
			assertEqual(d.set.name, "set name", "setter name");
			assertEqual(d.get.length, 0, "getter length");
			assertEqual(d.set.length, 1, "setter length");
			assertEqual(Function.prototype.toString.call(d.get), "function get name() { [native code] }", "getter source");
			assertEqual(Function.prototype.toString.call(d.set), "function set name() { [native code] }", "setter source");
			assert(!("prototype" in d.get), "no prototype on the getter");
			let threw = null;
			try { d.get.call({}); } catch (e) { threw = e.constructor.name; }
			assertEqual(threw, "TypeError", "brand check on the getter");
			threw = null;
			try { d.set.call({}, "x"); } catch (e) { threw = e.constructor.name; }
			assertEqual(threw, "TypeError", "brand check on the setter");
			threw = null;
			try { new d.get(); } catch (e) { threw = e.constructor.name; }
			assertEqual(threw, "TypeError", "the getter is not a constructor");
			assertEqual(Object.getOwnPropertyDescriptor(Window.prototype, "name"), undefined, "not on the prototype");
			assertConsistent("keys", Object.keys(d));
		`,
	}),

	basicTest({
		name: "framename-shadowing",
		js: `
			// var at the top level does not replace the accessor, and a
			// redefinition sticks the way it does natively
			const before = Object.getOwnPropertyDescriptor(window, "name");
			(0, eval)("var name = 'viaVar';");
			assertEqual(window.name, "viaVar", "var name assigns through the setter");
			assertEqual(Object.getOwnPropertyDescriptor(window, "name").get, before.get, "the accessor is still there");
			Object.defineProperty(window, "name", { value: "defined", configurable: true, writable: true });
			assertEqual(window.name, "defined", "redefined as data");
			Object.defineProperty(window, "name", before);
			assertEqual(window.name, "viaVar", "the accessor restored reads the real state");
			window.name = "";
		`,
	}),

	basicTest({
		name: "framename-subframe-persists-parity",
		js: `
			const f = document.createElement("iframe");
			f.src = "/";
			document.body.appendChild(f);
			await new Promise((r) => (f.onload = r));
			f.contentWindow.name = "kept";
			f.contentWindow.location.href = "/?again";
			await new Promise((r) => (f.onload = r));
			assertEqual(f.contentWindow.name, "kept", "a subframe keeps its name across its navigations");
			assertEqual(f.getAttribute("name"), null, "no attribute appears");
			f.name = "attr";
			assertEqual(f.contentWindow.name, "kept", "the attribute changing later does not rename the frame");
			assertConsistent("names", [f.contentWindow.name, f.name, f.getAttribute("name")]);
		`,
	}),
];

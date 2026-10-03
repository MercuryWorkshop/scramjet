import http from "http";
import type { AddressInfo } from "node:net";
import { serverTest, type Test } from "../testcommon.ts";

/**
 * URL fragments, end to end: navigating to one, reading it back, and every
 * place a `#` names something in the document rather than a resource.
 *
 * Nearly every test compares against bare Chrome with `assertConsistent`, so
 * the expected values are the browser's own. The hard asserts are the ones a
 * page would break on outright: a fragment navigation that reloads the
 * document, or a same-document reference that goes to the network.
 *
 * The harness puts its token in the page's fragment, which every page drops
 * before it starts (see `HELPERS`).
 */

/* eslint-disable quotes */

type Route =
	| string
	| { type: string; body: string }
	| ((req: http.IncomingMessage) => string);

/** Every page counts its own loads in sessionStorage, keyed by path. */
const HELPERS = `<script>
// the harness's token is the page's initial fragment, and random: drop it, so
// every URL the tests compare is the same in both browsers
if (location.hash.includes("runway_token=")) history.replaceState(history.state, "", location.href.split("#")[0]);
window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// polls rather than sleeping a fixed time, which a loaded machine outlasts
window.until = async (cond, ms = 5000) => {
	for (const end = Date.now() + ms; Date.now() < end; ) {
		if (cond()) return true;
		await sleep(20);
	}
	return cond();
};
window.loads = (key) => {
	const k = "loads:" + (key || location.pathname);
	const n = +(sessionStorage.getItem(k) || 0) + 1;
	sessionStorage.setItem(k, n);
	return n;
};
window.noReload = (key) => {
	if (loads(key) > 1) {
		fail("the document was reloaded: " + location.href);
		return false;
	}
	return true;
};
window.events = [];
addEventListener("hashchange", (e) => events.push("hashchange " + new URL(e.oldURL).hash + " -> " + new URL(e.newURL).hash));
addEventListener("popstate", () => events.push("popstate " + location.hash));
</script>`;

const page = (head: string, body = "") =>
	`<!doctype html><html><head><meta charset="utf-8">${HELPERS}${head}</head><body>${body}</body></html>`;

/**
 * `js` runs as the test on the page at `path`, and `routes` serves anything
 * else.
 *
 * The harness loads `/`, which navigates to that page on a second port - the
 * way a page is usually reached, by a link from another origin. The
 * document's real URL then carries its initiator's parameters, which are not
 * the ones the page's own URLs get, and that difference is exactly what a
 * fragment navigation has to see past.
 *
 * Another port rather than another host, so the two stay same-site. A
 * cross-site frame is put in its own process in bare Chrome, which has
 * history rules of its own - a navigation while it loads always replaces -
 * and under the proxy every frame is same-origin and in-process.
 */
function fragmentTest(props: {
	name: string;
	js: string;
	head?: string;
	body?: string;
	path?: string;
	routes?: Record<string, Route>;
}): Test {
	const entry = props.path ?? "/doc";
	let other: http.Server | null = null;
	let otherPort = 0;

	const handle = (req: http.IncomingMessage, res: http.ServerResponse) => {
		const path = (req.url ?? "/").split("?")[0];
		if (path === "/") {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(
				page(
					"",
					`<script>location.href = "http://localhost:${otherPort}${entry}";</script>`
				)
			);
			return;
		}
		if (path === entry) {
			// the fetch metadata this document was requested with. Not
			// `sec-fetch-dest`: bare Chrome runs the page in a frame, where
			// the proxy has it stand in for a top-level document
			const request = JSON.stringify(
				["sec-fetch-site", "sec-fetch-mode"].map(
					(name) => req.headers[name] ?? null
				)
			);
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(
				page(
					`<script>window.request = ${request};</script>` + (props.head ?? ""),
					(props.body ?? "") +
						`<script>runTest(async () => {\n${props.js}\n}, true);</script>`
				)
			);
			return;
		}

		const route = props.routes?.[path];
		if (route === undefined) {
			res.writeHead(404);
			res.end("not found");
			return;
		}
		if (typeof route === "string" || typeof route === "function") {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(page(typeof route === "function" ? route(req) : route));
		} else {
			res.writeHead(200, { "Content-Type": route.type });
			res.end(route.body);
		}
	};

	const test = serverTest({
		name: props.name,
		start: async (server) => {
			other = http.createServer(handle);
			await new Promise<void>((resolve) => other!.listen(0, resolve));
			otherPort = (other.address() as AddressInfo).port;
			server.on("request", handle);
		},
	});
	const stop = test.stop;
	test.stop = async () => {
		other?.closeAllConnections();
		await new Promise<void>((resolve) =>
			other ? other.close(() => resolve()) : resolve()
		);
		other = null;
		await stop();
	};

	return test;
}

const js = (body: string) => ({ type: "application/javascript", body });

export default [
	// --- the fragment as it is written -------------------------------------

	fragmentTest({
		name: "fragment-hash-setter-verbatim",
		js: `
			if (!noReload()) return;
			const read = () => [location.hash, location.href.slice(location.origin.length), document.URL.slice(location.origin.length)];
			const length = history.length;
			for (const value of ["a%2Fb", "a/b?c", "%", "café x", "#twice", "a#b", ":~:text=x", ""]) {
				const before = events.length;
				location.hash = value;
				// "" after "" is no change, and fires nothing
				await until(() => events.length > before, 1000);
				assertConsistent("set " + JSON.stringify(value), read());
			}
			await sleep(100);
			assertConsistent("length delta", history.length - length);
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-empty-is-not-none",
		js: `
			if (!noReload()) return;
			location.hash = "a";
			await sleep(20);
			location.href = location.href.split("#")[0] + "#";
			await until(() => location.href.endsWith("#"));
			await sleep(50);
			assertEqual(location.href.endsWith("#"), true, "an empty fragment is kept");
			assertConsistent("href", location.href.slice(location.origin.length));
			assertConsistent("hash", location.hash);
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-target-pseudo-class",
		head: `<style>:target { color: rgb(1, 2, 3); }</style>`,
		body: `<p id="sec">a</p><p id="café">b</p><p id="a b">c</p>`,
		js: `
			if (!noReload()) return;
			const colors = () => [...document.querySelectorAll("p")].map((p) => getComputedStyle(p).color);
			for (const value of ["sec", "café", "caf%C3%A9", "a b", "a%20b"]) {
				location.hash = value;
				await until(() => location.hash === new URL("#" + value, location).hash);
				await sleep(30);
				assertConsistent(":target " + value, colors());
				assertConsistent("querySelector :target " + value, document.querySelector(":target")?.id ?? null);
			}
		`,
	}),

	fragmentTest({
		name: "fragment-scrolls-to-element",
		body: `<div style="height: 5000px"></div><div id="far">far</div><div style="height: 5000px"></div>`,
		js: `
			if (!noReload()) return;
			scrollTo(0, 0);
			location.hash = "far";
			await until(() => scrollY > 1000, 2000);
			assert(scrollY > 1000, "location.hash scrolled to the element: " + scrollY);
			scrollTo(0, 0);
			const a = document.createElement("a");
			a.href = "#far";
			document.body.append(a);
			location.hash = "";
			await sleep(50);
			scrollTo(0, 0);
			a.click();
			await until(() => scrollY > 1000, 2000);
			assert(scrollY > 1000, "a link scrolled to the element: " + scrollY);
		`,
	}),

	fragmentTest({
		name: "fragment-initial-load-scrolls",
		routes: {
			"/tall": `<div style="height: 5000px"></div><div id="far">far</div><div style="height: 5000px"></div>
				<script>addEventListener("load", () => setTimeout(() => {
					assertConsistent("hash", location.hash);
					assert(scrollY > 1000, "the fragment on the initial load scrolled: " + scrollY);
					pass();
				}, 200));</script>`,
		},
		js: `
			location.href = "/tall#far";
			await new Promise(() => {});
		`,
	}),

	// --- fragment navigations stay in the document --------------------------

	...(
		[
			["href", `location.href = "#x"`],
			["assign", `location.assign("#x")`],
			["replace", `location.replace("#x")`],
			["href-absolute", `location.href = location.href.split("#")[0] + "#x"`],
			["location-object", `location = "#x"`],
			["document-location", `document.location = "#x"`],
			["window-open-self", `window.open("#x", "_self")`],
			["window-open-self-mixed-case", `window.open("#x", "_SeLf")`],
			[
				"link-click",
				`const a = document.createElement("a"); a.href = "#x"; document.body.append(a); a.click()`,
			],
			[
				"link-click-absolute",
				`const a = document.createElement("a"); a.href = location.href.split("#")[0] + "#x"; document.body.append(a); a.click()`,
			],
			[
				"link-click-whitespace",
				`const a = document.createElement("a"); a.setAttribute("href", "  #x"); document.body.append(a); a.click()`,
			],
			[
				"area-click",
				`const m = document.createElement("map"); const a = document.createElement("area"); a.href = "#x"; m.append(a); document.body.append(m); a.click()`,
			],
			[
				"svg-link-click",
				`const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); const a = document.createElementNS("http://www.w3.org/2000/svg", "a"); a.setAttribute("href", "#x"); s.append(a); document.body.append(s); a.dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
			],
			[
				"link-hash-setter",
				`const a = document.createElement("a"); a.href = location.href; a.hash = "x"; document.body.append(a); a.click()`,
			],
		] as [string, string][]
	).flatMap(([name, navigate]) =>
		(
			[
				["", ""],
				["after-hash", `location.hash = "first"; await sleep(30);`],
				[
					"after-pushstate",
					`history.pushState(null, "", "/pushed?q=1"); await sleep(30);`,
				],
				[
					"after-replacestate",
					`history.replaceState(null, "", location.pathname + "?utm=1"); await sleep(30);`,
				],
			] as [string, string][]
		).map(([when, before]) =>
			fragmentTest({
				name: `fragment-nav-${name}${when ? "-" + when : ""}`,
				js: `
					if (!noReload("doc")) return;
					${before}
					const length = history.length;
					${navigate};
					await until(() => location.hash === "#x" && events.some((e) => e.startsWith("hashchange") && e.endsWith("#x")));
					await sleep(50);
					assertEqual(location.hash, "#x", "the fragment was navigated to");
					assertConsistent("href", location.href.slice(location.origin.length));
					assertConsistent("length delta", history.length - length);
					assertConsistent("events", events);
				`,
			})
		)
	),

	fragmentTest({
		name: "fragment-nav-link-created-before-pushstate",
		js: `
			if (!noReload("doc")) return;
			// resolved when it is followed, not when it is written: the link
			// takes the URL the document has by then
			const a = document.createElement("a");
			a.href = "#x";
			document.body.append(a);
			history.pushState(null, "", "/elsewhere/deep");
			await sleep(30);
			a.click();
			await until(() => location.hash === "#x");
			await sleep(50);
			assertEqual(location.pathname, "/elsewhere/deep", "still on the pushed URL");
			assertConsistent("href", location.href.slice(location.origin.length));
			assertConsistent("a.href", a.href.slice(location.origin.length));
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-nav-parsed-link",
		body: `<a id="l" href="#parsed">l</a><a id="m" href="/doc#parsed2">m</a>`,
		js: `
			if (!noReload("doc")) return;
			document.getElementById("l").click();
			await until(() => location.hash === "#parsed");
			assertEqual(location.hash, "#parsed");
			document.getElementById("m").click();
			await until(() => location.hash === "#parsed2");
			assertEqual(location.hash, "#parsed2");
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-nav-meta-refresh",
		routes: {
			"/refresh": `<meta http-equiv="refresh" content="0; url=#refreshed">
				<script>
				if (loads() > 1) fail("the refresh reloaded the document");
				setTimeout(() => {
					assertEqual(location.hash, "#refreshed", "the refresh navigated to the fragment");
					assertConsistent("events", events);
					pass();
				}, 1500);
				</script>`,
		},
		js: `
			location.href = "/refresh";
			await new Promise(() => {});
		`,
	}),

	fragmentTest({
		name: "fragment-nav-with-base-element",
		head: `<base href="/other/">`,
		routes: {
			"/other/": `<script>
				assertConsistent("landed", location.href.slice(location.origin.length));
				pass();
			</script>`,
		},
		js: `
			// against a base elsewhere, #x names another document, and following
			// it loads that one - through the proxy
			if (loads() > 1) return fail("the entry page reloaded");
			const a = document.createElement("a");
			a.href = "#x";
			document.body.append(a);
			assertConsistent("a.href", a.href.slice(location.origin.length));
			a.click();
			await new Promise(() => {});
		`,
	}),

	fragmentTest({
		name: "fragment-nav-with-base-element-inserted-later",
		routes: {
			"/later/": `<script>
				assertConsistent("landed", location.href.slice(location.origin.length));
				pass();
			</script>`,
		},
		js: `
			if (loads() > 1) return fail("the entry page reloaded");
			const a = document.createElement("a");
			a.href = "#x";
			document.body.append(a);
			const base = document.createElement("base");
			base.href = "/later/";
			document.head.append(base);
			assertConsistent("a.href", a.href.slice(location.origin.length));
			a.click();
			await new Promise(() => {});
		`,
	}),

	fragmentTest({
		name: "fragment-nav-with-base-naming-the-document",
		head: `<base href="/doc">`,
		js: `
			if (!noReload()) return;
			const a = document.createElement("a");
			a.href = "#x";
			document.body.append(a);
			a.click();
			await until(() => location.hash === "#x");
			await sleep(50);
			assertEqual(location.hash, "#x");
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-base-href-resolution",
		path: "/dir/page",
		head: `<base href="sub/#frag">`,
		js: `
			const a = document.createElement("a");
			a.href = "rel";
			const b = document.querySelector("base");
			assertConsistent("baseURI", document.baseURI.slice(location.origin.length));
			assertConsistent("base.href", b.href.slice(location.origin.length));
			assertConsistent("a.href", a.href.slice(location.origin.length));
			assertConsistent("getAttribute", b.getAttribute("href"));
			const img = new Image();
			img.src = "img.png";
			assertConsistent("img.src", img.src.slice(location.origin.length));
		`,
	}),

	// only an HTML base element in the document's own tree sets its base URL
	...(
		[
			["template", `<template><base href="/wrong/"></template>`],
			["svg", `<svg><base href="/wrong/"></base></svg>`],
			["math", `<math><base href="/wrong/"></base></math>`],
			// an HTML integration point only with an HTML encoding
			[
				"annotation-xml",
				`<math><annotation-xml><base href="/wrong/"></base></annotation-xml></math>`,
			],
			// a title is an integration point in SVG, not in MathML
			[
				"math-title",
				`<math><title><base href="/wrong/"></base></title></math>`,
			],
		] as [string, string][]
	).map(([name, ignored]) =>
		fragmentTest({
			name: `fragment-base-ignores-${name}`,
			head: `${ignored}<base href="/right/">`,
			routes: {
				"/right/s.js": js(`window.loadedFrom = "right";`),
				"/wrong/s.js": js(`window.loadedFrom = "wrong";`),
			},
			body: `<script src="s.js"></script>`,
			js: `
				assertConsistent("script", window.loadedFrom ?? null);
				assertConsistent("baseURI", document.baseURI.slice(location.origin.length));
				const img = new Image();
				img.src = "x.png";
				assertConsistent("img.src", img.src.slice(location.origin.length));
			`,
		})
	),

	// and these are HTML base elements, which do count
	...(
		[
			[
				"svg-integration-point",
				`<svg><foreignObject><base href="/right/"></foreignObject></svg>`,
			],
			[
				"annotation-xml-html",
				`<math><annotation-xml encoding="text/html"><base href="/right/"></annotation-xml></math>`,
			],
			[
				"mathml-text-integration-point",
				`<math><mi><base href="/right/"></mi></math>`,
			],
			// an SVG element called template is not an inert HTML one
			[
				"svg-template",
				`<svg><template><foreignObject><base href="/right/"></foreignObject></template></svg>`,
			],
			// a breakout tag ends the SVG, so the base after it is in HTML
			["after-breakout", `<svg><p></p><base href="/right/"></svg>`],
		] as [string, string][]
	).map(([name, counted]) =>
		fragmentTest({
			name: `fragment-base-counts-${name}`,
			head: counted,
			routes: {
				"/right/s.js": js(`window.loadedFrom = "right";`),
				"/s.js": js(`window.loadedFrom = "document";`),
			},
			body: `<base href="/wrong/"><script src="s.js"></script>`,
			js: `
				assertConsistent("script", window.loadedFrom ?? null);
				assertConsistent("baseURI", document.baseURI.slice(location.origin.length));
			`,
		})
	),

	fragmentTest({
		name: "fragment-base-in-innerhtml",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<base href="/x/"><a href="y">y</a>';
			assertConsistent("a.href", d.querySelector("a").href.slice(location.origin.length));
			assertConsistent("innerHTML", d.innerHTML);
		`,
	}),

	// --- navigating to the document's own URL -------------------------------

	...(
		[
			["href", `location.href = location.href.split("#")[0]`],
			["assign", `location.assign(location.pathname + location.search)`],
			[
				"link",
				`const a = document.createElement("a"); a.href = location.pathname + location.search; document.body.append(a); a.click()`,
			],
		] as [string, string][]
	).map(([name, navigate]) =>
		fragmentTest({
			name: `fragment-self-navigation-${name}`,
			js: `
				// no fragment, so this loads the document again - requested by
				// the document itself this time, and not by the page that
				// first linked to it
				const n = loads("doc");
				if (n === 1) {
					assertConsistent("first request", request);
					history.replaceState(null, "", location.pathname + "?self=1");
					${navigate};
					await new Promise(() => {});
				}
				assertConsistent("second request", request);
				assertConsistent("href", location.href.slice(location.origin.length));
			`,
		})
	),

	// fails, and is the price of the test above: a navigation to the
	// document's own URL replaces its history entry, which the browser only
	// sees when the new real URL equals the old one - and it cannot, when the
	// new one has to name a different initiator
	fragmentTest({
		name: "fragment-self-navigation-replaces-entry",
		js: `
			const n = loads("doc");
			if (n === 1) {
				history.replaceState(null, "", location.pathname + "?self=1");
				// after the load event: a navigation while the document loads is
				// made a replace whatever its URL
				await new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r)));
				await sleep(0);
				sessionStorage.setItem("length", history.length);
				location.assign(location.href);
				await new Promise(() => {});
			}
			assertConsistent("length delta", history.length - +sessionStorage.getItem("length"));
		`,
	}),

	fragmentTest({
		name: "fragment-reload-keeps-fragment",
		js: `
			const n = loads("doc");
			if (n === 1) {
				location.hash = "kept";
				await sleep(30);
				location.reload();
				await new Promise(() => {});
			}
			assertEqual(location.hash, "#kept");
			assertConsistent("href", location.href.slice(location.origin.length));
		`,
	}),

	// --- history -------------------------------------------------------------

	fragmentTest({
		name: "fragment-history-urls",
		head: `<base href="/based/">`,
		js: `
			if (!noReload()) return;
			const out = [];
			const at = () => out.push(location.href.slice(location.origin.length));
			for (const url of ["#a", "?q=1#b", "", "#", "/p#c", "x#d", location.href, null]) {
				try {
					history.pushState(null, "", url);
					at();
				} catch (e) {
					out.push(e.name);
				}
			}
			assertConsistent("urls", out);
			history.replaceState(null, "", location.href);
			assertConsistent("replace with own", location.href.slice(location.origin.length));
		`,
	}),

	fragmentTest({
		name: "fragment-history-traversal",
		js: `
			if (!noReload()) return;
			location.hash = "a";
			await sleep(50);
			history.pushState(null, "", "#b");
			history.pushState(null, "", "#c");
			location.hash = "d";
			await sleep(50);
			const traverse = async (delta) => {
				const before = location.hash;
				history.go(delta);
				await until(() => location.hash !== before);
				// the events for the step, which follow the URL change
				await sleep(100);
				events.push("at " + location.hash);
			};
			for (let i = 0; i < 3; i++) await traverse(-1);
			await traverse(2);
			assertConsistent("events", events);
		`,
	}),

	fragmentTest({
		name: "fragment-history-about-blank",
		js: `
			const run = (w) => {
				const out = [];
				for (const url of ["#x", "about:blank#y", "?q", "/p", "about:srcdoc#z"]) {
					try {
						w.history.pushState(null, "", url);
						out.push(w.location.href);
					} catch (e) {
						out.push(e.name);
					}
				}
				return out;
			};
			const blank = document.createElement("iframe");
			document.body.append(blank);
			assertConsistent("about:blank", run(blank.contentWindow));
			const srcdoc = document.createElement("iframe");
			srcdoc.srcdoc = "<p>x</p>";
			document.body.append(srcdoc);
			await new Promise((r) => (srcdoc.onload = r));
			assertConsistent("srcdoc", run(srcdoc.contentWindow));
		`,
	}),

	// --- events ---------------------------------------------------------------

	fragmentTest({
		name: "fragment-hashchange-getter-shape",
		js: `
			const shape = (name) => {
				const d = Object.getOwnPropertyDescriptor(HashChangeEvent.prototype, name);
				let bad;
				try {
					d.get.call({});
					bad = "no throw";
				} catch (e) {
					bad = e.constructor.name;
				}
				return [
					typeof d.get,
					d.set,
					d.enumerable,
					d.configurable,
					d.get.name,
					d.get.length,
					Function.prototype.toString.call(d.get),
					bad,
				];
			};
			assertConsistent("oldURL", shape("oldURL"));
			assertConsistent("newURL", shape("newURL"));
			assertConsistent("own", Object.getOwnPropertyNames(HashChangeEvent.prototype));
			// a page's own event keeps whatever it was given, proxy-looking or not
			const odd = new HashChangeEvent("hashchange", { oldURL: "/x/y", newURL: "not a url" });
			assertConsistent("page-made", [odd.oldURL, odd.newURL]);
		`,
	}),

	fragmentTest({
		name: "fragment-onhashchange-attribute",
		body: `<script>document.body.setAttribute("onhashchange", "window.fromAttribute = location.hash + '|' + (typeof checkglobal)")</script>`,
		js: `
			if (!noReload()) return;
			location.hash = "attr";
			await until(() => window.fromAttribute !== undefined);
			assertConsistent("handler", window.fromAttribute ?? null);
		`,
	}),

	// --- references to an element in the document ----------------------------

	fragmentTest({
		name: "fragment-css-url-local-reference",
		head: `<style>.sheet { fill: url(#g); } .sheet2 { clip-path: url( "#c" ); }</style>`,
		body: `<svg width="10" height="10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><clipPath id="c"><rect width="5" height="5"/></clipPath></defs>
			<rect id="attr" width="10" height="10" style="fill: url(#g)"/>
			<rect id="sheet" class="sheet sheet2" width="10" height="10"/>
			<rect id="set" width="10" height="10"/></svg>`,
		js: `
			const set = document.getElementById("set");
			set.style.fill = "url(#g)";
			set.style.setProperty("mask", "url('#c')");
			const read = (id) => {
				const el = document.getElementById(id);
				const cs = getComputedStyle(el);
				return [el.getAttribute("style"), el.style.fill, cs.fill, cs.clipPath, cs.mask];
			};
			for (const id of ["attr", "sheet", "set"]) assertConsistent(id, read(id));
			assertConsistent("sheet text", [...document.styleSheets[0].cssRules].map((r) => r.cssText));
		`,
	}),

	fragmentTest({
		name: "fragment-svg-use-local-reference",
		body: `<svg width="40" height="40"><defs><symbol id="icon" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol></defs>
			<use id="plain" href="#icon" width="10" height="10"/>
			<use id="spaced" href=" #icon" width="10" height="10" x="10"/>
			<use id="xlink" xlink:href="#icon" width="10" height="10" x="20"/></svg>`,
		js: `
			const set = document.createElementNS("http://www.w3.org/2000/svg", "use");
			set.setAttribute("href", "#icon");
			set.setAttribute("width", "10");
			set.setAttribute("height", "10");
			document.querySelector("svg").append(set);
			await sleep(50);
			for (const use of document.querySelectorAll("use")) {
				const box = use.getBBox();
				assertConsistent("bbox " + (use.id || "set"), [box.width, box.height]);
				assertConsistent("href " + (use.id || "set"), [use.getAttribute("href"), use.href.baseVal]);
			}
		`,
	}),

	fragmentTest({
		name: "fragment-link-attribute-selectors",
		head: `<style>a[href="#"] { color: rgb(1, 2, 3); } a[href^="#s"] { color: rgb(4, 5, 6); }</style>`,
		body: `<a id="top" href="#">top</a><a id="sec" href="#sec">sec</a>`,
		js: `
			const color = (id) => getComputedStyle(document.getElementById(id)).color;
			assertConsistent("colors", [color("top"), color("sec")]);
			assertConsistent("matches", [document.querySelector('a[href="#"]')?.id, document.querySelector('a[href^="#s"]')?.id]);
		`,
	}),

	// --- URLs with fragments elsewhere ----------------------------------------

	fragmentTest({
		name: "fragment-request-and-response-urls",
		routes: { "/data": { type: "text/plain", body: "ok" } },
		js: `
			const own = (url) => url.slice(location.origin.length);
			assertConsistent("request", [own(new Request("#x").url), own(new Request("/data#y").url), own(new Request("/data#").url)]);
			const r = await fetch("/data#frag");
			assertConsistent("response.url", own(r.url));
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/data#frag");
			await new Promise((res) => { xhr.onload = res; xhr.send(); });
			assertConsistent("responseURL", own(xhr.responseURL));
			assertConsistent("new URL", own(new URL("#z", location).href));
		`,
	}),

	fragmentTest({
		name: "fragment-module-identity",
		routes: {
			"/m.js": js(
				`export const url = import.meta.url; window.evaluated = (window.evaluated || 0) + 1;`
			),
			"/entry.js": js(
				`import * as a from "/m.js#a"; import * as b from "/m.js#b"; window.staticA = a; window.staticB = b;`
			),
		},
		js: `
			const s = document.createElement("script");
			s.type = "module";
			s.src = "/entry.js";
			await new Promise((r) => { s.onload = r; s.onerror = r; document.head.append(s); });
			const a = await import("/m.js#a");
			const c = await import("/m.js#c");
			const own = (url) => url.slice(location.origin.length);
			assertConsistent("urls", [own(staticA.url), own(staticB.url), own(a.url), own(c.url)]);
			assertConsistent("same module", [a === staticA, a === staticB]);
			assertConsistent("evaluated", window.evaluated);
		`,
	}),

	fragmentTest({
		name: "fragment-module-import-escaping",
		routes: {
			"/m.js": js(`export const url = import.meta.url;`),
			// fragments a string literal has to escape
			"/entry.js": js(
				String.raw`import * as a from "/m.js#a\\"; import * as b from '/m.js#it\'s'; import * as c from "/m.js#\\\\x"; window.imported = [a.url, b.url, c.url];`
			),
		},
		js: `
			const s = document.createElement("script");
			s.type = "module";
			s.src = "/entry.js";
			await new Promise((r) => { s.onload = r; s.onerror = r; document.head.append(s); });
			const own = (url) => url.slice(location.origin.length);
			assertConsistent("imported", (window.imported ?? []).map(own));
		`,
	}),

	fragmentTest({
		name: "fragment-worker-location",
		routes: {
			"/w.js": js(
				`postMessage([location.hash, location.href.slice(location.origin.length)]);`
			),
		},
		js: `
			const w = new Worker("/w.js#work");
			const data = await new Promise((r) => (w.onmessage = (e) => r(e.data)));
			assertConsistent("worker", data);
		`,
	}),

	fragmentTest({
		name: "fragment-iframe",
		routes: {
			"/child": `<script>
				window.childLoads = loads();
				window.nav = (url) => {
					location.href = url;
				};
			</script>`,
		},
		js: `
			const f = document.createElement("iframe");
			f.src = "/child#one";
			document.body.append(f);
			await new Promise((r) => (f.onload = r));
			const w = f.contentWindow;
			const read = () => [w.location.hash, w.location.href.slice(location.origin.length), w.childLoads];
			assertConsistent("loaded", read());
			w.location.hash = "two";
			await until(() => w.location.hash === "#two");
			assertConsistent("hash setter", read());
			// from inside, with the frame's own function as the entry point: set
			// from out here - even through its eval - the URL is resolved against
			// this document, the entry settings object's, and reloads the frame
			w.setTimeout(w.nav, 0, "#three");
			await until(() => w.location.hash === "#three");
			assertConsistent("href setter", read());
			w.eval('const a = document.createElement("a"); a.href = "#four"; document.body.append(a); a.click()');
			await until(() => w.location.hash === "#four");
			assertConsistent("link", read());
			assertEqual(w.childLoads, 1, "the frame never reloaded");
		`,
	}),

	fragmentTest({
		name: "fragment-blob-url",
		js: `
			const url = URL.createObjectURL(new Blob(["<p>x</p>"], { type: "text/html" }));
			const own = (u) => u.replace(url, "BLOB");
			const a = document.createElement("a");
			a.href = url + "#frag";
			assertConsistent("a.href", own(a.href));
			const f = document.createElement("iframe");
			f.src = url + "#page=2";
			document.body.append(f);
			await new Promise((r) => (f.onload = r));
			assertConsistent("frame", [own(f.src), f.contentWindow.location.hash, own(f.contentWindow.location.href)]);
			const v = document.createElement("video");
			v.src = url + "#t=5";
			assertConsistent("video.src", own(v.src));
		`,
	}),

	fragmentTest({
		name: "fragment-referrer-header-excludes-fragment",
		routes: {
			"/next": (req) => `<script>
				assertConsistent("header", ${JSON.stringify(
					(req.headers.referer ?? "").replace(/^https?:\/\/[^/]+/, "")
				)});
				pass();
			</script>`,
		},
		js: `
			if (loads() > 1) return fail("the entry page reloaded");
			location.hash = "secret";
			await until(() => location.hash === "#secret");
			location.href = "/next";
			await new Promise(() => {});
		`,
	}),

	// fails for another reason: `document.referrer` is empty in every frame
	// under the proxy, fragment or not
	fragmentTest({
		name: "fragment-document-referrer-excludes-fragment",
		routes: {
			"/next": `<script>
				assertConsistent("referrer", document.referrer.slice(location.origin.length));
				pass();
			</script>`,
		},
		js: `
			if (loads() > 1) return fail("the entry page reloaded");
			location.hash = "secret";
			await until(() => location.hash === "#secret");
			location.href = "/next";
			await new Promise(() => {});
		`,
	}),
] as Test[];

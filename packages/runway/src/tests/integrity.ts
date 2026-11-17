import crypto from "node:crypto";
import { serverTest } from "../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Subresource integrity.
//
// The proxy never checks a digest. Every script and stylesheet the browser
// loads is the rewritten one, which no digest the page computed can match, so
// `integrity` is blanked in the live DOM and a resource loads whatever its
// digest. What the page sees must still be exactly what it wrote: the IDL
// attributes, the content attribute and every route that observes it, and a
// resource with a *correct* digest must load exactly as it would natively -
// same order, same events, same number of fetches.
//
// Every test but the last is differential against bare Chrome. The resources
// under `/r/` are generated from their path, and each one is written so the
// rewriter has to change it; a digest that happened to survive rewriting would
// hide the bug these tests are here to catch.
//
// https://w3c.github.io/webappsec-subresource-integrity/

/**
 * The body of `/r/<name>.<ext>`, shared between the server, the digests in
 * the markup and the page (which recomputes them with `crypto.subtle`).
 */
const BODY_SOURCE = `function bodyOf(path) {
	path = path.split("?")[0];
	var file = path.slice(path.lastIndexOf("/") + 1);
	var name = file.slice(0, file.lastIndexOf("."));
	var ext = file.slice(file.lastIndexOf(".") + 1);
	var n = JSON.stringify(name);
	if (ext === "js") return "(self.__ran || (self.__ran = [])).push(" + n + "); self.__where = location.pathname;\\n";
	if (ext === "mjs") return "(self.__ran || (self.__ran = [])).push(" + n + "); self.__where = location.pathname;\\nexport default " + n + ";\\n";
	if (ext === "css") return ".c-" + name + " { color: rgb(1, 2, 3); background-image: url(\\"/r/" + name + ".png\\"); }\\n";
	if (ext === "json") return JSON.stringify({ name: name, at: "/r/" + name + ".json" });
	if (ext === "html") return "<!doctype html><p id=x>" + name + "</p><a href=\\"/r/" + name + ".txt\\">t</a>";
	return null;
}`;

const bodyOf: (path: string) => string | null = new Function(
	`${BODY_SOURCE}; return bodyOf;`
)();

const TYPES: Record<string, string> = {
	js: "text/javascript",
	mjs: "text/javascript",
	css: "text/css",
	json: "application/json",
	html: "text/html",
};

const digest = (alg: string, body: string) =>
	`${alg}-${crypto.createHash(alg).update(body).digest("base64")}`;

/** A well-formed digest that matches nothing. */
const WRONG = `sha384-${Buffer.alloc(48).toString("base64")}`;

/**
 * `@@sha384:/r/a.js@@` becomes that resource's digest, `@@wrong@@` a digest
 * that matches nothing, and `@@xo@@` a second origin on the same server.
 */
function fill(text: string, port: number): string {
	return text
		.replace(/@@(sha256|sha384|sha512):([^@]+)@@/g, (_, alg, path) =>
			digest(alg, bodyOf(path)!)
		)
		.replace(/@@wrong@@/g, WRONG)
		.replace(/@@xo@@/g, `http://127.0.0.1:${port}`);
}

const PRELUDE = `
	${BODY_SOURCE}
	const XO = "@@xo@@";
	const WRONG = "@@wrong@@";
	const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
	const ALGS = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
	const sri = async (path, alg = "sha384") =>
		alg + "-" + b64(await crypto.subtle.digest(ALGS[alg], new TextEncoder().encode(bodyOf(path))));
	const ran = () => (self.__ran || []).slice();
	const settle = (el, ms = 4000) => new Promise((resolve) => {
		el.addEventListener("load", () => resolve("load"), { once: true });
		el.addEventListener("error", () => resolve("error"), { once: true });
		setTimeout(() => resolve("timeout"), ms);
	});
	const loaded = () => document.readyState === "complete"
		? Promise.resolve()
		: new Promise((r) => addEventListener("load", r, { once: true }));
	const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
	const shown = (v) => v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v);
	const threw = (e) => "THREW " + (e && e.name) + ": " + (e && e.message);
	const C = (label, v) => assertConsistent(label, shown(v));
	const rec = (label, f) => { let v; try { v = f(); } catch (e) { v = threw(e); } C(label, v); return v; };
	const arec = async (label, f) => { let v; try { v = await f(); } catch (e) { v = threw(e); } C(label, v); return v; };
	const color = (cls, doc = document) => {
		const d = doc.createElement("div");
		d.className = cls;
		doc.body.append(d);
		const c = doc.defaultView.getComputedStyle(d).color;
		d.remove();
		return c;
	};
	const fetches = (path) => performance.getEntriesByType("resource")
		.filter((e) => new URL(e.name).pathname === path).length;
	const view = (el) => [el.integrity, el.getAttribute("integrity"), el.hasAttribute("integrity"), el.outerHTML];
`;

function sriTest(props: {
	name: string;
	js: string;
	head?: string;
	body?: string;
	headers?: Record<string, string>;
	scramjetOnly?: boolean;
	/**
	 * Load the test script itself with its digest, for a page under a policy
	 * that refuses scripts without one.
	 */
	testIntegrity?: boolean;
	/** Extra routes, tried before the resources. */
	route?: (req: any, res: any, port: number) => boolean;
}) {
	return serverTest({
		name: props.name,
		scramjetOnly: props.scramjetOnly,
		start: async (server, port) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (props.route && props.route(req, res, port)) return;
				const test = fill(
					`runTest(async () => {\n${PRELUDE}\n${props.js}\n}, true);`,
					port
				);
				if (path === "/") {
					const own = props.testIntegrity
						? ` integrity="${digest("sha384", test)}" crossorigin="anonymous"`
						: "";
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						...props.headers,
					});
					res.end(
						fill(
							`<!doctype html><html><head>${props.head ?? ""}</head><body>${props.body ?? ""}<script src="/__test.js"${own}></script></body></html>`,
							port
						)
					);
				} else if (path === "/__test.js") {
					res.writeHead(200, {
						"Content-Type": "text/javascript; charset=utf-8",
						"Access-Control-Allow-Origin": "*",
					});
					res.end(test);
				} else if (path.startsWith("/r/") && bodyOf(path) !== null) {
					const ext = path.slice(path.lastIndexOf(".") + 1);
					res.writeHead(200, {
						"Content-Type": TYPES[ext],
						"Access-Control-Allow-Origin": "*",
						"Timing-Allow-Origin": "*",
						"Cache-Control": "no-store",
					});
					res.end(bodyOf(path));
				} else {
					res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
					res.end();
				}
			});
		},
	});
}

export default [
	// --- loading, with digests that are right ---------------------------------

	sriTest({
		name: "integrity-parsed-scripts",
		head: `
			<script id="p1" src="/r/p1.js" integrity="@@sha384:/r/p1.js@@"></script>
			<script id="p2" src="/r/p2.js" integrity="@@sha256:/r/p2.js@@ @@sha512:/r/p2.js@@"></script>
			<script id="p3" src="/r/p3.js" integrity="@@sha512:/r/p3.js@@" crossorigin="anonymous"></script>
			<script id="p4" src="/r/p4.js" integrity="  @@sha384:/r/p4.js@@?opt=1	"></script>
			<script id="p5" src="/r/p5.js" integrity="md5-AAAA sha1-BBBB"></script>
			<script id="p6" src="/r/p6.js" integrity=""></script>
			<script id="p7" src="/r/p7.js" INTEGRITY="@@sha384:/r/p7.js@@"></script>
			<script id="p8" src="/r/p8.js" integrity="@@sha384:/r/p8.js@@" defer></script>
			<script id="p9" type="module" src="/r/p9.mjs" integrity="@@sha384:/r/p9.mjs@@"></script>
			<script id="p10" src="/r/p10.js" integrity="@@sha384:/r/p10.js@@" crossorigin="use-credentials"></script>
			<script id="p11" src="@@xo@@/r/p11.js" integrity="@@sha384:/r/p11.js@@" crossorigin="anonymous"></script>
			<script id="p12" src="/r/p12.js" integrity="@@sha384:/r/p12.js@@ @@wrong@@"></script>
		`,
		js: `
			await loaded();
			const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p10", "p11", "p12", "p8", "p9"];
			assertEqual(JSON.stringify(ran()), JSON.stringify(order), "every script ran, in document order");
			C("ran", ran());
			for (let i = 1; i <= 12; i++) {
				const s = document.getElementById("p" + i);
				C("p" + i, view(s));
			}
			C("fetches", ["/r/p1.js", "/r/p8.js", "/r/p9.mjs", "/r/p11.js"].map(fetches));
		`,
	}),

	sriTest({
		name: "integrity-parsed-links",
		head: `
			<link id="s1" rel="stylesheet" href="/r/s1.css" integrity="@@sha384:/r/s1.css@@">
			<link id="s2" rel="stylesheet" href="@@xo@@/r/s2.css" integrity="@@sha256:/r/s2.css@@" crossorigin>
			<link id="s3" rel="preload" as="style" href="/r/s3.css" integrity="@@sha384:/r/s3.css@@" onload="this.rel='stylesheet'">
			<link id="pl" rel="preload" as="script" href="/r/pl.js" integrity="@@sha384:/r/pl.js@@">
			<link id="mp" rel="modulepreload" href="/r/mp.mjs" integrity="@@sha384:/r/mp.mjs@@">
			<link id="pf" rel="preload" as="fetch" href="/r/pf.json" integrity="@@sha384:/r/pf.json@@" crossorigin>
		`,
		body: `<script id="plc" src="/r/pl.js" integrity="@@sha384:/r/pl.js@@"></script>`,
		js: `
			await loaded();
			await tick(200);
			C("colors", ["c-s1", "c-s2", "c-s3"].map((c) => color(c)));
			assertEqual(color("c-s1"), "rgb(1, 2, 3)", "the stylesheet applies");
			C("s3 rel", document.getElementById("s3").rel);
			C("sheets", document.styleSheets.length);
			const mod = await import("/r/mp.mjs");
			C("modulepreload", [mod.default, ran()]);
			const pf = await arec("preload fetch", async () => (await fetch("/r/pf.json", { integrity: await sri("/r/pf.json") })).json());
			for (const id of ["s1", "s2", "s3", "pl", "mp", "pf", "plc"]) C(id, view(document.getElementById(id)));
			// not /r/pf.json: a fetch preload is never used proxied, with or
			// without integrity - the fetch's proxy URL is not the preload's
			C("fetches", ["/r/s1.css", "/r/s3.css", "/r/pl.js", "/r/mp.mjs"].map(fetches));
		`,
	}),

	sriTest({
		name: "integrity-dynamic-scripts",
		js: `
			await loaded();
			const cases = {
				propBefore: async (s, p) => { s.integrity = await sri(p); s.src = p; },
				propAfter: async (s, p) => { s.src = p; s.integrity = await sri(p); },
				setAttribute: async (s, p) => { s.setAttribute("integrity", await sri(p)); s.src = p; },
				setAttributeUpper: async (s, p) => { s.setAttribute("INTEGRITY", await sri(p)); s.src = p; },
				setAttributeNS: async (s, p) => { s.setAttributeNS(null, "integrity", await sri(p)); s.src = p; },
				attrNode: async (s, p) => { const a = document.createAttribute("integrity"); a.value = await sri(p); s.setAttributeNode(a); s.src = p; },
				attrNodeLater: async (s, p) => { const a = document.createAttribute("integrity"); s.setAttributeNode(a); a.value = await sri(p); s.src = p; },
				namedItem: async (s, p) => { s.setAttribute("integrity", "x"); s.attributes.integrity.value = await sri(p); s.src = p; },
				toggle: async (s, p) => { s.toggleAttribute("integrity"); s.src = p; },
				multiple: async (s, p) => { s.integrity = (await sri(p, "sha256")) + " " + (await sri(p, "sha512")); s.src = p; },
				withWrong: async (s, p) => { s.integrity = WRONG + " " + (await sri(p)); s.src = p; },
				fixed: async (s, p) => { s.integrity = WRONG; s.integrity = await sri(p); s.src = p; },
				removed: async (s, p) => { s.integrity = WRONG; s.removeAttribute("integrity"); s.src = p; },
				crossOrigin: async (s, p) => { s.crossOrigin = "anonymous"; s.integrity = await sri(p); s.src = XO + p; },
				module: async (s, p) => { s.type = "module"; s.integrity = await sri(p); s.src = p; },
				async: async (s, p) => { s.async = false; s.integrity = await sri(p); s.src = p; },
			};
			for (const [name, setup] of Object.entries(cases)) {
				const s = document.createElement("script");
				const p = "/r/d-" + name + (name === "module" ? ".mjs" : ".js");
				await setup(s, p);
				const done = settle(s);
				document.head.append(s);
				C(name, [await done, ...view(s)]);
			}
			{
				// a clone of a script that has not started is a script like any other
				const t = document.createElement("script");
				t.integrity = await sri("/r/d-clone.js");
				t.src = "/r/d-clone.js";
				const s = t.cloneNode();
				const done = settle(s);
				document.head.append(s);
				C("clone", [await done, ...view(s)]);
			}
			{
				// changing integrity once the fetch has started changes nothing
				const s = document.createElement("script");
				s.src = "/r/d-late.js";
				const done = settle(s);
				document.head.append(s);
				s.integrity = WRONG;
				C("late", [await done, ...view(s)]);
			}
			{
				const s = document.createElement("script");
				s.integrity = await sri("/r/d-text.js");
				s.text = bodyOf("/r/d-text.js");
				document.head.append(s);
				C("inline", [ran().includes("d-text"), ...view(s)]);
			}
			C("ran", ran().sort());
			assertEqual(ran().length, Object.keys(cases).length + 3, "every script ran");
		`,
	}),

	sriTest({
		name: "integrity-dynamic-links",
		js: `
			await loaded();
			const sheet = async (name, setup) => {
				const l = document.createElement("link");
				l.rel = "stylesheet";
				const p = "/r/" + name + ".css";
				await setup(l, p);
				const done = settle(l);
				document.head.append(l);
				C(name, [await done, color("c-" + name), ...view(l)]);
			};
			await sheet("l-prop", async (l, p) => { l.integrity = await sri(p); l.href = p; });
			await sheet("l-attr", async (l, p) => { l.setAttribute("integrity", await sri(p, "sha512")); l.href = p; });
			await sheet("l-after", async (l, p) => { l.href = p; l.integrity = await sri(p); });
			await sheet("l-xo", async (l, p) => { l.crossOrigin = "anonymous"; l.integrity = await sri(p); l.href = XO + p; });
			await sheet("l-multi", async (l, p) => { l.integrity = (await sri(p, "sha256")) + " " + WRONG + " " + (await sri(p)); l.href = p; });
			{
				const l = document.createElement("link");
				l.rel = "modulepreload";
				l.integrity = await sri("/r/l-mp.mjs");
				l.href = "/r/l-mp.mjs";
				const done = settle(l);
				document.head.append(l);
				C("modulepreload", [await done, ...view(l)]);
				const m = await import("/r/l-mp.mjs");
				C("modulepreload import", [m.default, ran()]);
			}
			{
				const l = document.createElement("link");
				l.rel = "preload";
				l.as = "script";
				l.integrity = await sri("/r/l-pl.js");
				l.href = "/r/l-pl.js";
				const done = settle(l);
				document.head.append(l);
				C("preload", [await done, ...view(l)]);
				const s = document.createElement("script");
				s.integrity = l.integrity;
				s.src = "/r/l-pl.js";
				const ran2 = settle(s);
				document.head.append(s);
				C("preload consumer", [await ran2, ran()]);
			}
			{
				// the rel changes after the fact; integrity goes with it
				const l = document.createElement("link");
				l.rel = "preload";
				l.as = "style";
				l.integrity = await sri("/r/l-flip.css");
				l.href = "/r/l-flip.css";
				document.head.append(l);
				await settle(l);
				l.rel = "stylesheet";
				await tick(300);
				C("flip", [color("c-l-flip"), ...view(l)]);
			}
			C("fetches", ["/r/l-prop.css", "/r/l-mp.mjs", "/r/l-pl.js", "/r/l-flip.css"].map(fetches));
		`,
	}),

	sriTest({
		name: "integrity-markup-apis",
		head: `<script>document.write('<script id="dw" src="/r/m-dw.js" integrity="@@sha384:/r/m-dw.js@@"><\\/script>')</script>`,
		js: `
			await loaded();
			C("document.write", [ran(), ...view(document.getElementById("dw"))]);
			const tag = async (kind, name) => kind === "css"
				? '<link rel="stylesheet" href="/r/' + name + '.css" integrity="' + (await sri("/r/" + name + ".css")) + '">'
				: '<script src="/r/' + name + '.js" integrity="' + (await sri("/r/" + name + ".js")) + '"><\\/script>';
			const sheet = async (label, name, insert) => {
				const link = await insert(await tag("css", name));
				const res = await settle(link);
				C(label, [res, color("c-" + name), ...view(link)]);
			};
			await sheet("innerHTML", "m-ih", async (html) => { const d = document.createElement("div"); d.innerHTML = html; document.body.append(d); return d.firstChild; });
			await sheet("insertAdjacentHTML", "m-iah", async (html) => { document.body.insertAdjacentHTML("beforeend", html); return document.body.lastChild; });
			await sheet("outerHTML", "m-oh", async (html) => { const d = document.createElement("div"); document.body.append(d); d.outerHTML = html; return document.body.lastChild; });
			await sheet("setHTMLUnsafe", "m-shu", async (html) => { const d = document.createElement("div"); d.setHTMLUnsafe(html); document.body.append(d); return d.firstChild; });
			await sheet("DOMParser", "m-dp", async (html) => { const doc = new DOMParser().parseFromString(html, "text/html"); const l = doc.head.firstChild; document.head.append(l); return l; });
			await sheet("parseHTMLUnsafe", "m-phu", async (html) => { const doc = Document.parseHTMLUnsafe(html); const l = doc.head.firstChild; document.head.append(document.importNode(l)); return document.head.lastChild; });
			await sheet("template", "m-tpl", async (html) => { const t = document.createElement("template"); t.innerHTML = html; document.head.append(t.content.cloneNode(true)); return document.head.lastChild; });
			{
				const f = document.createRange().createContextualFragment(await tag("js", "m-cf"));
				const s = f.firstChild;
				const done = settle(s);
				document.body.append(f);
				C("createContextualFragment", [await done, ...view(s)]);
			}
			{
				const ifr = document.createElement("iframe");
				ifr.srcdoc = (await tag("js", "m-sd")) + (await tag("css", "m-sd"));
				const done = settle(ifr);
				document.body.append(ifr);
				await done;
				await tick(200);
				const w = ifr.contentWindow;
				C("srcdoc", [w.__ran, color("c-m-sd", ifr.contentDocument), view(ifr.contentDocument.querySelector("script"))]);
			}
			C("ran", ran().sort());
		`,
	}),

	sriTest({
		name: "integrity-importmap",
		head: `
			<script type="importmap" id="map">{
				"imports": { "im-bare": "/r/im-bare.mjs", "im-prefix/": "/r/" },
				"integrity": {
					"/r/im-bare.mjs": "@@sha384:/r/im-bare.mjs@@",
					"/r/im-parsed.mjs": "@@sha256:/r/im-parsed.mjs@@",
					"./r/im-rel.mjs": "@@sha512:/r/im-rel.mjs@@",
					"@@xo@@/r/im-xo.mjs": "@@sha384:/r/im-xo.mjs@@",
					"/r/im-prefixed.mjs": "@@sha384:/r/im-prefixed.mjs@@",
					"/r/im-static.mjs": "@@sha384:/r/im-static.mjs@@",
					"/r/im-dyn.mjs": 5
				}
			}</script>
			<script type="module" src="/r/im-parsed.mjs"></script>
			<script type="module">import s from "/r/im-static.mjs"; self.__static = s;</script>
		`,
		js: `
			await loaded();
			await tick(100);
			C("parsed", [ran(), self.__static]);
			for (const spec of ["im-bare", "/r/im-rel.mjs", XO + "/r/im-xo.mjs", "im-prefix/im-prefixed.mjs", "/r/im-dyn.mjs"]) {
				await arec("import " + spec, async () => (await import(spec)).default);
			}
			const map = document.getElementById("map");
			C("map", [map.textContent, map.text, map.innerHTML, map.type, map.integrity, map.getAttribute("integrity")]);
			{
				// a second map, added late, merges
				const late = document.createElement("script");
				late.type = "importmap";
				late.textContent = JSON.stringify({ imports: { "im-late": "/r/im-late.mjs" }, integrity: { "/r/im-late.mjs": await sri("/r/im-late.mjs") } });
				document.head.append(late);
				await arec("late map", async () => (await import("im-late")).default);
				C("late map text", late.textContent);
			}
			C("ran", ran().sort());
		`,
	}),

	sriTest({
		name: "integrity-link-header",
		headers: {
			Link: [
				`</r/lh.js>; rel=preload; as=script; integrity="@@sha384:/r/lh.js@@"`,
				`</r/lh.css>; rel=preload; as=style; integrity="@@sha384:/r/lh.css@@"`,
				`</r/lh.mjs>; rel=modulepreload; integrity="@@sha384:/r/lh.mjs@@"`,
			].join(", "),
		},
		body: `
			<script id="lh" src="/r/lh.js" integrity="@@sha384:/r/lh.js@@"></script>
			<link id="lhc" rel="stylesheet" href="/r/lh.css" integrity="@@sha384:/r/lh.css@@">
		`,
		js: `
			await loaded();
			await tick(200);
			C("script", [ran(), ...view(document.getElementById("lh"))]);
			C("sheet", [color("c-lh"), ...view(document.getElementById("lhc"))]);
			await arec("modulepreload", async () => (await import("/r/lh.mjs")).default);
			C("ran", ran());
			await arec("header", async () => (await fetch(location.href)).headers.get("link"));
		`,
	}),

	sriTest({
		name: "integrity-policy-header",
		testIntegrity: true,
		headers: {
			"Integrity-Policy": "blocked-destinations=(script)",
			"Integrity-Policy-Report-Only":
				"blocked-destinations=(script), endpoints=(nowhere)",
		},
		head: `
			<script id="ok1" src="/r/ip-ok1.js" integrity="@@sha384:/r/ip-ok1.js@@" crossorigin="anonymous"></script>
			<script id="ok2" src="@@xo@@/r/ip-ok2.js" integrity="@@sha384:/r/ip-ok2.js@@" crossorigin="anonymous"></script>
			<script id="ok3" type="module" src="/r/ip-ok3.mjs" integrity="@@sha384:/r/ip-ok3.mjs@@"></script>
		`,
		js: `
			await loaded();
			C("ran", ran());
			assertEqual(ran().length, 3, "scripts with integrity metadata are allowed");
			const s = document.createElement("script");
			s.crossOrigin = "anonymous";
			s.integrity = await sri("/r/ip-dyn.js");
			s.src = "/r/ip-dyn.js";
			const done = settle(s);
			document.head.append(s);
			C("dynamic", [await done, ...view(s)]);
			await arec("headers", async () => {
				const h = (await fetch(location.href)).headers;
				return [h.get("integrity-policy"), h.get("integrity-policy-report-only")];
			});
		`,
	}),

	sriTest({
		// natively, a script without integrity metadata is blocked under the
		// policy. The proxy has to blank every digest, so it cannot hand the
		// policy to the browser, and lets everything through
		name: "integrity-policy-header-never-enforced",
		scramjetOnly: true,
		headers: { "Integrity-Policy": "blocked-destinations=(script)" },
		head: `
			<script id="bad1" src="/r/ipb-1.js"></script>
			<script id="bad2" src="/r/ipb-2.js" crossorigin="anonymous"></script>
			<script id="bad3" src="/r/ipb-3.js" integrity="@@sha384:/r/ipb-3.js@@"></script>
		`,
		js: `
			await loaded();
			assertEqual(JSON.stringify(ran()), JSON.stringify(["ipb-1", "ipb-2", "ipb-3"]), "parsed scripts run");
			const s = document.createElement("script");
			s.src = "/r/ipb-dyn.js";
			const done = settle(s);
			document.head.append(s);
			assertEqual(await done, "load", "a dynamic script without integrity loads");
			const h = (await fetch(location.href)).headers;
			assertEqual(h.get("integrity-policy"), "blocked-destinations=(script)", "the page still reads the header");
		`,
	}),

	// --- fetch and Request ----------------------------------------------------

	sriTest({
		name: "integrity-fetch",
		js: `
			const text = (r) => r.text();
			for (const p of ["/r/f.js", "/r/f.mjs", "/r/f.css", "/r/f.json", "/r/f.html"]) {
				await arec("right " + p, async () => [(await fetch(p, { integrity: await sri(p) })).status, (await fetch(p, { integrity: await sri(p, "sha512") }).then(text)) === bodyOf(p)]);
			}
			await arec("multiple", async () => (await fetch("/r/f.js", { integrity: WRONG + " " + (await sri("/r/f.js", "sha256")) })).status);
			await arec("wrong", async () => (await fetch("/r/f.js", { integrity: WRONG })).status);
			await arec("unknown alg", async () => (await fetch("/r/f.js", { integrity: "md5-AAAA" })).status);
			await arec("garbage", async () => (await fetch("/r/f.js", { integrity: "not a digest" })).status);
			await arec("empty", async () => (await fetch("/r/f.js", { integrity: "" })).status);
			await arec("cors", async () => (await fetch(XO + "/r/fx.js", { integrity: await sri("/r/fx.js") })).status);
			await arec("no-cors cross-origin", async () => (await fetch(XO + "/r/fx.js", { mode: "no-cors", integrity: await sri("/r/fx.js") })).type);
			await arec("no-cors same-origin", async () => (await fetch("/r/f.js", { mode: "no-cors", integrity: await sri("/r/f.js") })).type);
			await arec("404", async () => (await fetch("/r/none.bin", { integrity: WRONG })).status);
			await arec("Request", async () => (await fetch(new Request("/r/f.js", { integrity: await sri("/r/f.js") }))).status);
			await arec("Request wrong", async () => (await fetch(new Request("/r/f.js", { integrity: WRONG }))).status);
			await arec("Request overridden", async () => (await fetch(new Request("/r/f.js", { integrity: WRONG }), { integrity: "" })).status);
			await arec("Request xo", async () => (await fetch(new Request(XO + "/r/fx.js", { integrity: await sri("/r/fx.js") }))).status);

			const vals = ["sha384-abc", "", "  sp  ", null, undefined, 5, { toString() { return "obj"; } }];
			for (const v of vals) rec("init " + String(v), () => new Request("/r/f.js", { integrity: v }).integrity);
			rec("init symbol", () => new Request("/r/f.js", { integrity: Symbol() }).integrity);
			rec("default", () => new Request("/r/f.js").integrity);
			const r = new Request("/r/f.js", { integrity: "sha256-x" });
			rec("clone", () => r.clone().integrity);
			rec("copy", () => new Request(r).integrity);
			rec("copy override", () => new Request(r, { integrity: "sha512-y" }).integrity);
			rec("copy blank", () => new Request(r, { integrity: "" }).integrity);
			rec("copy method", () => new Request(r, { method: "POST" }).integrity);
			rec("no-cors ctor", () => new Request(XO + "/r/fx.js", { mode: "no-cors", integrity: "sha256-x" }).integrity);
			const d = Object.getOwnPropertyDescriptor(Request.prototype, "integrity");
			rec("descriptor", () => [typeof d.get, d.set, d.enumerable, d.configurable, d.get.name, d.get.length, Function.prototype.toString.call(d.get)]);
			rec("illegal", () => d.get.call({}));
		`,
	}),

	sriTest({
		name: "integrity-fetch-worker",
		route: (req, res) => {
			if (req.url === "/worker.js") {
				res.writeHead(200, { "Content-Type": "text/javascript" });
				res.end(`
					onmessage = async (e) => {
						const out = {};
						for (const [k, init] of Object.entries(e.data)) {
							try {
								const r = await fetch(k.split(" ")[0], init);
								out[k] = [r.status, r.type, (await r.text()).length];
							} catch (err) { out[k] = "THREW " + err.name + ": " + err.message; }
						}
						out.request = new Request("/r/w.js", { integrity: "sha256-q" }).integrity;
						postMessage(out);
					};
				`);
				return true;
			}
			return false;
		},
		js: `
			const jobs = {
				"/r/w.js right": { integrity: await sri("/r/w.js") },
				"/r/w.js wrong": { integrity: WRONG },
				"/r/w.css right": { integrity: await sri("/r/w.css", "sha512") },
			};
			for (const type of ["classic", "module"]) {
				const w = new Worker("/worker.js", { type });
				const got = new Promise((r) => (w.onmessage = (e) => r(e.data)));
				w.postMessage(jobs);
				C(type, await got);
				w.terminate();
			}
		`,
	}),

	// --- what the page can see ------------------------------------------------

	sriTest({
		name: "integrity-reflection",
		js: `
			const X = "text/x-none";
			for (const tag of ["script", "link"]) {
				const P = tag === "script" ? HTMLScriptElement : HTMLLinkElement;
				const mk = () => { const e = document.createElement(tag); if (tag === "script") e.type = X; else e.rel = "x-none"; return e; };
				const e = mk();
				rec(tag + " default", () => view(e));
				const vals = ["sha384-abc", "", "  sha256-x?y  ", "a\\u0000b", "\\ud800", "ünï", null, undefined, 0, true, { toString() { return "obj"; } }];
				for (const v of vals) {
					const el = mk();
					rec(tag + " prop " + JSON.stringify(String(v)), () => { el.integrity = v; return view(el); });
					const el2 = mk();
					rec(tag + " attr " + JSON.stringify(String(v)), () => { el2.setAttribute("integrity", v); return view(el2); });
				}
				rec(tag + " symbol", () => { const el = mk(); el.integrity = Symbol(); return view(el); });
				rec(tag + " throwing toString", () => { const el = mk(); el.integrity = { toString() { throw new RangeError("t"); } }; return view(el); });

				const d = Object.getOwnPropertyDescriptor(P.prototype, "integrity");
				rec(tag + " descriptor", () => [typeof d.get, typeof d.set, d.enumerable, d.configurable, d.get.name, d.set.name, d.get.length, d.set.length, "prototype" in d.get, Function.prototype.toString.call(d.get), Function.prototype.toString.call(d.set)]);
				rec(tag + " own names", () => Object.getOwnPropertyNames(P.prototype));
				rec(tag + " for-in", () => { const k = []; for (const x in e) if (x === "integrity" || x === "src" || x === "href" || x === "crossOrigin") k.push(x); return k; });
				rec(tag + " get on body", () => d.get.call(document.body));
				rec(tag + " set on body", () => d.set.call(document.body, "x"));
				rec(tag + " get on null", () => d.get.call(null));
				rec(tag + " set no args", () => { const el = mk(); d.set.call(el); return view(el); });
				rec(tag + " hasOwn", () => [Object.hasOwn(e, "integrity"), "integrity" in e, Object.hasOwn(P.prototype, "integrity"), Object.hasOwn(HTMLElement.prototype, "integrity")]);
				rec(tag + " cross-kind", () => { const other = document.createElement(tag === "script" ? "link" : "script"); return d.get.call(other); });
			}

			for (const tag of ["img", "a", "iframe", "div", "audio", "style"]) {
				const el = document.createElement(tag);
				rec(tag + " no idl", () => ["integrity" in el, el.integrity]);
				rec(tag + " attr", () => { el.setAttribute("integrity", "sha256-x"); return [el.getAttribute("integrity"), el.outerHTML, el.integrity]; });
			}
			{
				const svg = document.createElementNS("http://www.w3.org/2000/svg", "script");
				rec("svg script", () => { svg.setAttribute("integrity", "sha256-x"); return ["integrity" in svg, svg.getAttribute("integrity"), svg.outerHTML]; });
				const x = document.createElementNS("urn:x", "script");
				rec("foreign script", () => { x.setAttribute("integrity", "sha256-x"); return [x.getAttribute("integrity"), x.outerHTML]; });
			}
			{
				const s = document.createElement("script");
				s.type = X;
				s.setAttributeNS("urn:x", "x:integrity", "ns-value");
				rec("namespaced", () => [s.integrity, s.getAttribute("x:integrity"), s.getAttributeNS("urn:x", "integrity"), s.getAttribute("integrity"), s.getAttributeNames(), s.outerHTML]);
				s.integrity = "own";
				rec("namespaced + own", () => [s.integrity, s.getAttributeNS("urn:x", "integrity"), s.getAttributeNS(null, "integrity"), s.getAttributeNames(), s.outerHTML]);
				s.removeAttributeNS("urn:x", "integrity");
				rec("namespaced removed", () => [s.integrity, s.getAttributeNames(), s.outerHTML]);
			}

			{
				const s = document.createElement("script");
				s.type = X;
				s.integrity = "sha384-one";
				rec("attributes", () => [s.attributes.length, s.getAttributeNames(), [...s.attributes].map((a) => [a.name, a.value, a.localName, a.namespaceURI, a.prefix, a.specified, a.nodeValue, a.textContent])]);
				rec("named item", () => [s.attributes.getNamedItem("integrity").value, s.attributes.integrity.value, s.attributes["integrity"].value, s.attributes.item(1).value, s.getAttributeNode("integrity").value, s.getAttributeNodeNS(null, "integrity").value]);
				rec("own keys", () => Object.getOwnPropertyNames(s.attributes));
				const a = s.getAttributeNode("integrity");
				a.value = "sha384-two";
				rec("attr node write", () => [a.value, ...view(s)]);
				a.textContent = "sha384-three";
				rec("attr textContent write", () => [a.value, ...view(s)]);
				a.nodeValue = "sha384-four";
				rec("attr nodeValue write", () => [a.value, ...view(s)]);
				const removed = s.removeAttributeNode(a);
				rec("removed node", () => [removed.value, removed.ownerElement, ...view(s)]);
				a.value = "sha384-detached";
				rec("detached write", () => [a.value, ...view(s)]);
				s.setAttributeNode(a);
				rec("reattached", () => [a.ownerElement === s, ...view(s)]);
				rec("toggle off", () => [s.toggleAttribute("integrity"), ...view(s)]);
				rec("toggle on", () => [s.toggleAttribute("integrity"), ...view(s)]);
				rec("toggle force", () => [s.toggleAttribute("integrity", true), ...view(s)]);
				s.integrity = "sha384-five";
				rec("toggle force keeps", () => [s.toggleAttribute("integrity", true), ...view(s)]);
				rec("remove", () => { s.removeAttribute("INTEGRITY"); return view(s); });
				rec("remove twice", () => { s.removeAttribute("integrity"); return view(s); });
				const fresh = document.createAttribute("INTEGRITY");
				fresh.value = "sha384-six";
				rec("created attr", () => [fresh.name, s.setAttributeNode(fresh), ...view(s)]);
				const other = document.createElement("script");
				rec("in use", () => other.setAttributeNode(fresh));
				const moved = s.attributes.removeNamedItem("integrity");
				rec("removeNamedItem", () => [moved.value, ...view(s)]);
				rec("setNamedItem", () => [s.attributes.setNamedItem(moved), ...view(s)]);
				rec("replace", () => { const n = document.createAttribute("integrity"); n.value = "sha384-seven"; const old = s.setAttributeNode(n); return [old.value, old.ownerElement, ...view(s)]; });
			}

			{
				const s = document.createElement("script");
				s.type = X;
				s.integrity = "sha384-a";
				const t = document.createElement("script");
				t.type = X;
				t.integrity = "sha384-b";
				const u = document.createElement("script");
				u.type = X;
				u.integrity = "sha384-a";
				const none = document.createElement("script");
				none.type = X;
				rec("isEqualNode", () => [s.isEqualNode(t), s.isEqualNode(u), s.isEqualNode(none), s.isEqualNode(s.cloneNode())]);
				const c = s.cloneNode(true);
				s.integrity = "sha384-changed";
				rec("clone independent", () => [view(c), view(s)]);
				rec("importNode", () => view(document.importNode(c)));
				const doc = document.implementation.createHTMLDocument("");
				rec("adoptNode", () => view(doc.adoptNode(c.cloneNode())));
				rec("foreign document", () => { const f = doc.createElement("script"); f.integrity = "sha256-f"; return [...view(f), view(document.importNode(f))]; });
				const d = document.createElement("div");
				d.append(s, t);
				rec("innerHTML", () => d.innerHTML);
				rec("getHTML", () => d.getHTML());
				rec("XMLSerializer", () => new XMLSerializer().serializeToString(d));
				rec("range", () => { const r = document.createRange(); r.selectNodeContents(d); const f = r.cloneContents(); const w = document.createElement("div"); w.append(f); return w.innerHTML; });
				rec("textContent", () => d.textContent);
			}

			{
				const d = document.createElement("div");
				d.innerHTML = '<script type="text/x-none" integrity="sha256-x"></scr' + 'ipt><link rel="x-none" integrity=" y "><link rel="stylesheet" integrity="z" href="data:text/css,"><script INTEGRITY="upper" type="text/x-none"></scr' + 'ipt>';
				rec("parsed", () => [...d.children].map(view));
				rec("parsed html", () => d.innerHTML);
				rec("parsed clone", () => d.cloneNode(true).innerHTML);
				const t = document.createElement("template");
				t.innerHTML = d.innerHTML;
				rec("template", () => [...t.content.children].map(view));
				const doc = new DOMParser().parseFromString(d.innerHTML, "text/html");
				rec("DOMParser", () => [...doc.querySelectorAll("script, link")].map(view));
				const xml = new DOMParser().parseFromString('<root xmlns="http://www.w3.org/1999/xhtml"><script integrity="sha256-xml" type="text/x-none"/></root>', "application/xhtml+xml");
				rec("DOMParser xhtml", () => view(xml.querySelector("script")));
			}

			{
				const ifr = document.createElement("iframe");
				document.body.append(ifr);
				const W = ifr.contentWindow;
				const s = document.createElement("script");
				s.type = X;
				s.integrity = "sha384-realm";
				const other = W.document.createElement("script");
				other.integrity = "sha384-other";
				rec("cross-realm get", () => [Object.getOwnPropertyDescriptor(W.HTMLScriptElement.prototype, "integrity").get.call(s), Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "integrity").get.call(other)]);
				rec("cross-realm set", () => { Object.getOwnPropertyDescriptor(W.HTMLScriptElement.prototype, "integrity").set.call(s, "sha384-set"); return view(s); });
				rec("adopted into frame", () => view(W.document.adoptNode(s)));
				rec("frame element", () => view(other));
				ifr.remove();
			}
		`,
	}),

	sriTest({
		name: "integrity-parsed-reflection",
		head: `
			<link id="l1" rel="x-none" integrity="sha256-link">
			<script id="s1" type="text/x-none" integrity=" sha384-script ">x</script>
			<script id="s2" type="text/x-none" integrity>x</script>
			<script id="s3" type="text/x-none" INTEGRITY="upper" integrity="dup">x</script>
		`,
		body: `<svg><script id="svg1" integrity="sha256-svg"></script></svg>`,
		js: `
			for (const id of ["l1", "s1", "s2", "s3"]) rec(id, () => view(document.getElementById(id)));
			rec("svg", () => { const s = document.getElementById("svg1"); return [s.getAttribute("integrity"), s.outerHTML]; });
			rec("head", () => [...document.head.children].filter((e) => e.id).map((e) => e.outerHTML));
			rec("attributes", () => [...document.getElementById("s3").attributes].map((a) => a.name + "=" + a.value));
		`,
	}),

	sriTest({
		name: "integrity-selectors",
		head: `
			<script id="a" type="text/x-none" integrity="sha384-abc def"></script>
			<script id="b" type="text/x-none" integrity=""></script>
			<script id="c" type="text/x-none"></script>
			<link id="d" rel="x-none" integrity="SHA256-Q">
		`,
		js: `
			const q = (sel) => { try { return [...document.querySelectorAll(sel)].map((e) => e.id).filter(Boolean).join(); } catch (e) { return threw(e); } };
			const sels = [
				"[integrity]", ":not([integrity])", '[integrity=""]', '[integrity="sha384-abc def"]', '[integrity^="sha"]',
				'[integrity$="def"]', '[integrity*="abc"]', '[integrity~="def"]', '[integrity|="sha384"]', '[integrity="sha256-q" i]',
				'[integrity="sha256-q" s]', "[INTEGRITY]", 'script[integrity^="sha384"]', 'link[integrity]', ':is([integrity^="sha"], #c)',
				':has(> [integrity^="sha"])', '[*|integrity]', '[integrity=sha384-abc]',
			];
			for (const s of sels) rec(s, () => q(s));
			const a = document.getElementById("a");
			rec("matches", () => [a.matches('[integrity^="sha384"]'), a.matches('[integrity=""]'), a.closest('[integrity~="abc"]')?.id]);
			a.integrity = "sha512-new";
			rec("after write", () => [q('[integrity^="sha512"]'), q('[integrity^="sha384"]')]);
			rec("getElementsByTagName", () => document.getElementsByTagName("script").length);
		`,
	}),

	sriTest({
		// selectors in a stylesheet match the live DOM
		name: "integrity-css-selectors",
		head: `
			<style>
				link[integrity] { display: block; width: 1px; }
				link[integrity^="sha256"] { width: 2px; }
				link[integrity=""] { height: 3px; }
			</style>
			<link id="l" rel="x-none" integrity="sha256-q">
		`,
		js: `
			const l = document.getElementById("l");
			const st = () => { const cs = getComputedStyle(l); return [cs.display, cs.width, cs.height]; };
			rec("parsed", st);
			l.integrity = "sha512-q";
			rec("written", st);
			l.integrity = "";
			rec("empty", st);
		`,
	}),

	sriTest({
		// a fetch preload's body is not rewritten, so its digest is handed to the
		// browser as it is - whichever order rel, as and integrity are set in -
		// and every other link's is blanked. A selector in a stylesheet sees
		// the live attribute, which nothing else the page can reach does
		name: "integrity-fetch-preload-digest",
		scramjetOnly: true,
		head: `
			<style>
				link[integrity="sha256-q"] { display: block; width: 5px; }
				link[integrity=""] { display: block; width: 1px; }
			</style>
			<link id="parsed" rel="preload" as="fetch" href="/r/fp-parsed.json" integrity="sha256-q" crossorigin>
			<link id="parsed2" rel="PRELOAD  other" as="FETCH" href="/r/fp-parsed2.json" integrity="sha256-q" crossorigin>
			<link id="parsedScript" rel="preload" as="script" href="/r/fp-script.js" integrity="sha256-q">
			<link id="parsedPrefetch" rel="prefetch" as="fetch" href="/r/fp-prefetch.json" integrity="sha256-q">
		`,
		js: `
			await loaded();
			const live = (l) => ({ "5px": "kept", "1px": "blanked" })[getComputedStyle(l).width] ?? getComputedStyle(l).width;
			const expect = (label, l, want) => {
				assertEqual(live(l), want, label + ": live digest");
				assertEqual(l.integrity, "sha256-q", label + ": page's digest");
				assertEqual(l.getAttribute("integrity"), "sha256-q", label + ": page's attribute");
			};
			expect("parsed", document.getElementById("parsed"), "kept");
			expect("parsed, mixed case and tokens", document.getElementById("parsed2"), "kept");
			expect("parsed script preload", document.getElementById("parsedScript"), "blanked");
			expect("parsed prefetch", document.getElementById("parsedPrefetch"), "blanked");
			const orders = {
				attrsFirst: ["kept", (l) => { l.setAttribute("rel", "preload"); l.setAttribute("as", "fetch"); l.setAttribute("integrity", "sha256-q"); }],
				attrsLast: ["kept", (l) => { l.setAttribute("integrity", "sha256-q"); l.setAttribute("rel", "preload"); l.setAttribute("as", "fetch"); }],
				idlFirst: ["kept", (l) => { l.rel = "preload"; l.as = "fetch"; l.integrity = "sha256-q"; }],
				idlLast: ["kept", (l) => { l.integrity = "sha256-q"; l.rel = "preload"; l.as = "fetch"; }],
				relList: ["kept", (l) => { l.integrity = "sha256-q"; l.as = "fetch"; l.relList.add("preload"); }],
				relListValue: ["kept", (l) => { l.integrity = "sha256-q"; l.as = "fetch"; l.relList = "preload"; }],
				attrNode: ["kept", (l) => { l.integrity = "sha256-q"; l.rel = "preload"; const a = document.createAttribute("as"); a.value = "fetch"; l.setAttributeNode(a); }],
				leaves: ["blanked", (l) => { l.rel = "preload"; l.as = "fetch"; l.integrity = "sha256-q"; l.as = "style"; }],
				unset: ["blanked", (l) => { l.rel = "preload"; l.as = "fetch"; l.integrity = "sha256-q"; l.removeAttribute("as"); }],
				relRemoved: ["blanked", (l) => { l.rel = "preload"; l.as = "fetch"; l.integrity = "sha256-q"; l.relList.remove("preload"); }],
			};
			for (const [name, [want, setup]] of Object.entries(orders)) {
				const l = document.createElement("link");
				setup(l);
				document.head.append(l);
				expect(name, l, want);
				l.remove();
			}
		`,
	}),

	sriTest({
		name: "integrity-xpath",
		head: `<script id="a" type="text/x-none" integrity="sha384-abc"></script>`,
		js: `
			const x = (e) => { try { const r = document.evaluate(e, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); const out = []; for (let i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i).id || r.snapshotItem(i).nodeValue); return out; } catch (err) { return threw(err); } };
			for (const e of ['//script[@integrity]/@id', '//script[@integrity="sha384-abc"]/@id', '//script/@integrity', 'count(//@integrity)', 'string(//script/@integrity)'])
				rec(e, () => e.startsWith("count") || e.startsWith("string") ? document.evaluate(e, document, null, XPathResult.ANY_TYPE, null)[e.startsWith("count") ? "numberValue" : "stringValue"] : x(e));
		`,
	}),

	sriTest({
		name: "integrity-mutation-observer",
		js: `
			const s = document.createElement("script");
			s.type = "text/x-none";
			document.body.append(s);
			const mo = new MutationObserver(() => {});
			mo.observe(s, { attributes: true, attributeOldValue: true });
			s.integrity = "sha384-a";
			s.setAttribute("integrity", "sha384-b");
			s.integrity = "sha384-b";
			s.removeAttribute("integrity");
			s.toggleAttribute("integrity");
			rec("records", () => mo.takeRecords().map((r) => [r.type, r.attributeName, r.attributeNamespace, r.oldValue]));
			const filtered = new MutationObserver(() => {});
			filtered.observe(s, { attributeFilter: ["integrity"], attributeOldValue: true });
			s.integrity = "sha384-c";
			rec("filtered", () => filtered.takeRecords().map((r) => [r.attributeName, r.oldValue]));
		`,
	}),

	// --- never enforced -------------------------------------------------------

	sriTest({
		// natively every one of these is blocked; the proxy lets them all through
		name: "integrity-never-enforced",
		scramjetOnly: true,
		head: `
			<script type="importmap">{ "integrity": { "/r/nw-9.mjs": "@@wrong@@" } }</script>
			<script id="w1" src="/r/nw-1.js" integrity="@@wrong@@"></script>
			<script id="w2" src="@@xo@@/r/nw-2.js" integrity="@@sha384:/r/nw-2.js@@"></script>
			<script id="w3" type="module" src="/r/nw-3.mjs" integrity="@@wrong@@"></script>
			<link id="w4" rel="stylesheet" href="/r/nw-4.css" integrity="@@wrong@@">
			<link id="w5" rel="modulepreload" href="/r/nw-5.mjs" integrity="@@wrong@@">
			<script id="w6" src="/r/nw-6.js" integrity="@@sha256:/r/nw-6.js@@ @@wrong@@"></script>
		`,
		js: `
			await loaded();
			assertEqual(JSON.stringify(ran()), JSON.stringify(["nw-1", "nw-2", "nw-6", "nw-3"]), "parsed scripts with bad digests run");
			assertEqual(color("c-nw-4"), "rgb(1, 2, 3)", "a stylesheet with a bad digest applies");
			assertEqual((await import("/r/nw-5.mjs")).default, "nw-5", "a module preloaded with a bad digest imports");
			assertEqual((await import("/r/nw-9.mjs")).default, "nw-9", "an import map digest is not enforced");
			const s = document.createElement("script");
			s.integrity = WRONG;
			s.src = "/r/nw-7.js";
			document.head.append(s);
			assertEqual(await settle(s), "load", "a dynamic script with a bad digest loads");
			const l = document.createElement("link");
			l.rel = "stylesheet";
			l.integrity = WRONG;
			l.href = "/r/nw-8.css";
			document.head.append(l);
			assertEqual(await settle(l), "load", "a dynamic stylesheet with a bad digest loads");
			assertEqual(s.integrity, WRONG, "and the page still sees its digest");
		`,
	}),
];

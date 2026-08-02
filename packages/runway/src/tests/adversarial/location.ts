import { basicTest } from "../../testcommon.ts";

// The location proxy is the single most-read API on the web: every router,
// analytics tag and CDN loader decomposes it. It has to look like a real
// Location and it must never hand back a proxy URL.
//
// The harness loads the page with a `#runway_token=…` fragment, so these tests
// avoid asserting an absolute href and check internal consistency instead.

const setForm = (name: string, code: string) =>
	basicTest({
		name: `location-set-${name}`,
		js: `
			location.hash = "start";
			assertEqual(location.hash, "#start", "precondition");
			${code}
			await new Promise((r) => setTimeout(r, 300));
			assertEqual(location.hash, "#target", "hash after the assignment");
			assertEqual(location.pathname, "/", "a fragment-only write must not change the path");
			location.hash = "";
		`,
	});

export default [
	basicTest({
		name: "location-components",
		js: `
			assertEqual(location.protocol, "http:", "protocol");
			assertEqual(location.hostname, "localhost", "hostname");
			assertEqual(location.pathname, "/", "pathname");
			assertEqual(location.search, "", "search");
			assert(location.port.length > 0, "port is present");
			assertEqual(location.host, "localhost:" + location.port, "host");
			assertEqual(location.origin, "http://localhost:" + location.port, "origin");
			assertEqual(
				location.href,
				location.origin + location.pathname + location.search + location.hash,
				"href is the concatenation of its parts"
			);
			assert(!location.href.includes("/~/sj/"), "href must not expose the proxy URL");
			assert(!location.href.includes(":4500"), "href must not expose the harness origin");
		`,
	}),
	basicTest({
		name: "location-stringify",
		js: `
			assertEqual(location.toString(), location.href, "toString");
			assertEqual(String(location), location.href, "String()");
			assertEqual(location + "", location.href, "concatenation");
			assertEqual(\`\${location}\`, location.href, "template literal");
			assertEqual(location.valueOf(), location, "valueOf returns the object itself");
			assertEqual([location].join(), location.href, "Array.join coercion");
		`,
	}),
	basicTest({
		name: "location-brand",
		js: `
			assertEqual(Object.prototype.toString.call(location), "[object Location]", "brand check");
			assert(location instanceof Location, "instanceof Location");
			assertEqual(location.constructor, Location, "constructor");
			assertEqual(typeof location.assign, "function", "assign");
			assertEqual(typeof location.replace, "function", "replace");
			assertEqual(typeof location.reload, "function", "reload");
			assertEqual(location.assign.name, "assign", "assign.name");
			assertEqual(location.reload.length, 0, "reload.length");
			assert("href" in location, "href in location");
		`,
	}),
	basicTest({
		name: "location-descriptors",
		js: `
			assert(Object.prototype.hasOwnProperty.call(location, "href"), "href is an own property");
			const d = Object.getOwnPropertyDescriptor(location, "href");
			assertEqual(typeof d.get, "function", "href has a getter");
			assertEqual(typeof d.set, "function", "href has a setter");
			assertEqual(d.enumerable, true, "href is enumerable");
			assert(Object.keys(location).includes("href"), "Object.keys includes href");
			assertEqual(JSON.parse(JSON.stringify(location)).href, location.href, "href survives a JSON round trip");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: ancestorOrigins is missing from the proxy entirely.
		name: "location-ancestororigins",
		js: `
			assert("ancestorOrigins" in location, "ancestorOrigins must exist");
			assertEqual(typeof location.ancestorOrigins, "object", "ancestorOrigins is an object");
			assertEqual(typeof location.ancestorOrigins.length, "number", "it has a length");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the proxy carries an own `constructor` property that a
		// real Location does not - a one-line fingerprint.
		name: "location-own-property-names",
		js: `
			assertDeepEqual(
				Object.getOwnPropertyNames(location).sort(),
				["ancestorOrigins", "assign", "hash", "host", "hostname", "href", "origin",
				 "pathname", "port", "protocol", "reload", "replace", "search", "toString", "valueOf"],
				"own property names must match a real Location"
			);
		`,
	}),
	basicTest({
		name: "location-identity",
		js: `
			assertEqual(window.location, location, "window.location === location");
			assertEqual(document.location, location, "document.location === location");
			assertEqual(self.location, location, "self.location === location");
			assertEqual(window.location, window.location, "stable identity");
			assertEqual(globalThis.location, location, "globalThis.location");
		`,
	}),
	basicTest({
		name: "location-url-resolution",
		js: `
			assertEqual(new URL("/x", location).href, location.origin + "/x", "location as a URL base");
			assertEqual(new URL("/x", location.href).href, location.origin + "/x", "href as a base");
			assertEqual(new URL("./y", location.href).href, location.origin + "/y", "relative resolution");
			assertEqual(new URL(location.href).origin, location.origin, "origin round trip");
			assertEqual(new URL("?q=1", location.href).search, "?q=1", "query-only relative");
			const u = new URL(location.href);
			assertEqual(u.protocol + "//" + u.host, location.origin, "decomposition agrees");
		`,
	}),
	basicTest({
		name: "location-document-urls",
		js: `
			assertEqual(document.URL, location.href, "document.URL");
			assertEqual(document.documentURI, location.href, "document.documentURI");
			assertEqual(document.baseURI, location.href, "document.baseURI");
			assertEqual(window.origin, location.origin, "window.origin");
			assertEqual(self.origin, location.origin, "self.origin");
		`,
	}),
	basicTest({
		name: "location-resource-urls",
		js: `
			assertEqual(document.querySelector("script").src, location.origin + "/script.js",
				"script.src resolves against the real origin");
			const nav = performance.getEntriesByType("navigation")[0];
			assertEqual(nav.name, location.href, "navigation timing entry name");
			assertEqual(new URL("/r", document.baseURI).href, location.origin + "/r",
				"baseURI is usable as a base");
		`,
	}),

	// ------------------------------------------------------------------
	// mutation
	// ------------------------------------------------------------------
	basicTest({
		name: "location-hash-roundtrip",
		js: `
			location.hash = "alpha";
			assertEqual(location.hash, "#alpha", "hash after set");
			assertEqual(location.href, location.origin + "/#alpha", "href includes the hash");
			location.hash = "#beta";
			assertEqual(location.hash, "#beta", "hash set with a leading #");
			assertEqual(new URL(location.href).hash, "#beta", "URL agrees");
			location.hash = "a b";
			assertEqual(location.hash, "#a%20b", "spaces are percent-encoded");
			location.hash = "";
			assertEqual(location.hash, "", "cleared");
		`,
	}),
	basicTest({
		name: "location-hashchange-event",
		js: `
			const before = location.href;
			const ev = await new Promise((resolve) => {
				window.addEventListener("hashchange", resolve, { once: true });
				location.hash = "changed";
			});
			assertEqual(ev.oldURL, before, "hashchange oldURL");
			assertEqual(ev.newURL, location.href, "hashchange newURL");
			assert(!ev.newURL.includes("/~/sj/"), "hashchange URLs must not expose the proxy URL");
			location.hash = "";
		`,
	}),
	setForm("href", `location.href = "#target";`),
	setForm("bare", `location = "#target";`),
	setForm("window", `window.location = "#target";`),
	setForm("window-href", `window.location.href = "#target";`),
	setForm("document", `document.location = "#target";`),
	setForm("document-href", `document.location.href = "#target";`),
	setForm("self-href", `self.location.href = "#target";`),
	setForm("hash", `location.hash = "target";`),
	setForm("assign", `location.assign("#target");`),
	setForm("replace", `location.replace("#target");`),

	// ------------------------------------------------------------------
	// history - the router path
	// ------------------------------------------------------------------
	basicTest({
		name: "location-history-pushstate",
		js: `
			history.pushState({ a: 1 }, "", "/newpath?q=1#h");
			assertEqual(location.pathname, "/newpath", "pathname");
			assertEqual(location.search, "?q=1", "search");
			assertEqual(location.hash, "#h", "hash");
			assertEqual(location.href, location.origin + "/newpath?q=1#h", "href");
			assertDeepEqual(history.state, { a: 1 }, "history.state");
			history.replaceState({ b: 2 }, "", "/other");
			assertEqual(location.pathname, "/other", "pathname after replaceState");
			assertEqual(location.search, "", "search cleared");
			assertEqual(location.hash, "", "hash cleared");
			assertDeepEqual(history.state, { b: 2 }, "replaced state");
		`,
	}),
	basicTest({
		name: "location-history-pushstate-url-forms",
		js: `
			history.pushState(null, "", location.origin + "/abs?x=2");
			assertEqual(location.href, location.origin + "/abs?x=2", "absolute same-origin URL");
			history.pushState(null, "", "relative");
			assertEqual(location.href, location.origin + "/relative", "relative resolves against the current path");
			history.pushState(null, "", "?onlyquery");
			assertEqual(location.pathname, "/relative", "query-only keeps the path");
			assertEqual(location.search, "?onlyquery", "query applied");
			history.pushState(null, "", "/");
			assertEqual(location.href, location.origin + "/", "back to the root");
		`,
	}),
	basicTest({
		name: "location-history-popstate",
		js: `
			history.pushState({ step: 1 }, "", "/step1");
			history.pushState({ step: 2 }, "", "/step2");
			assertEqual(location.pathname, "/step2", "at step2");
			const ev = await new Promise((resolve) => {
				window.addEventListener("popstate", resolve, { once: true });
				history.back();
			});
			assertDeepEqual(ev.state, { step: 1 }, "popstate state");
			assertEqual(location.pathname, "/step1", "location follows the popstate");
			assertDeepEqual(history.state, { step: 1 }, "history.state follows too");
		`,
	}),
	basicTest({
		name: "location-search-params",
		js: `
			history.replaceState(null, "", "/p?a=1&b=two");
			assertEqual(location.search, "?a=1&b=two", "search");
			assertEqual(new URLSearchParams(location.search).get("b"), "two", "URLSearchParams");
			assertEqual(new URL(location.href).searchParams.get("a"), "1", "URL.searchParams");
			history.replaceState(null, "", "/p?enc=a%20b%26c");
			assertEqual(new URLSearchParams(location.search).get("enc"), "a b&c", "encoded values survive");
		`,
	}),
];

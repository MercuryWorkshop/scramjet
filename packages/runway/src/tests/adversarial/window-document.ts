import { basicTest } from "../../testcommon.ts";

// The window/document surface a page reads on startup: readiness and lifecycle
// events, the Navigation API that modern routers prefer over history, media
// queries, viewport metrics and graphics contexts. Feature detection here
// decides which code path a site takes, so a missing or wrong value changes
// behaviour long before anything visibly breaks.

export default [
	basicTest({
		name: "windoc-lifecycle",
		js: `
			assertEqual(document.readyState, "loading", "readyState while a body script runs");
			const seen = [];
			document.addEventListener("readystatechange", () => seen.push(document.readyState));
			document.addEventListener("DOMContentLoaded", () => seen.push("dcl"));
			await new Promise((r) => window.addEventListener("load", r, { once: true }));
			seen.push("load:" + document.readyState);
			assert(seen.includes("dcl"), "DOMContentLoaded fired: " + JSON.stringify(seen));
			assert(seen.includes("interactive"), "the interactive state was observed: " + JSON.stringify(seen));
			assertEqual(seen[seen.length - 1], "load:complete",
				"readyState is complete by load: " + JSON.stringify(seen));
		`,
	}),
	basicTest({
		name: "windoc-lifecycle-listeners",
		js: `
			// registering these must not throw; sites attach them for session
			// bookkeeping and beacons
			const noop = () => {};
			for (const type of ["beforeunload", "pagehide", "pageshow", "visibilitychange", "freeze", "resume"]) {
				window.addEventListener(type, noop);
				window.removeEventListener(type, noop);
			}
			assertEqual(typeof document.visibilityState, "string", "visibilityState");
			assertEqual(document.visibilityState, "visible", "the frame is visible");
			assertEqual(typeof document.hidden, "boolean", "document.hidden");
			assertEqual(typeof document.hasFocus(), "boolean", "hasFocus");
		`,
	}),
	basicTest({
		name: "windoc-document-properties",
		js: `
			document.title = "adversarial-title";
			assertEqual(document.title, "adversarial-title", "title round trip");
			assertEqual(document.head.tagName, "HEAD", "document.head");
			assertEqual(document.body.tagName, "BODY", "document.body");
			assertEqual(document.documentElement.tagName, "HTML", "documentElement");
			assertEqual(document.compatMode, "CSS1Compat", "compatMode");
			assertEqual(document.contentType, "text/html", "contentType");
			assertEqual(document.activeElement, document.body, "activeElement defaults to body");
			assertEqual(document.defaultView, window, "defaultView");
			assertEqual(document.ownerDocument, null, "document.ownerDocument");
		`,
	}),
	basicTest({
		name: "windoc-window-name",
		js: `
			const before = window.name;
			window.name = "adversarial-window-name";
			assertEqual(window.name, "adversarial-window-name", "window.name round trip");
			window.name = before;
			assertEqual(window.name, before, "restored");
		`,
	}),
	basicTest({
		name: "windoc-navigation-api",
		js: `
			if (typeof navigation === "undefined") { pass(); return; }
			assertEqual(typeof navigation.currentEntry, "object", "currentEntry");
			assert(!navigation.currentEntry.url.includes("/~/sj/"),
				"navigation.currentEntry.url must not expose the proxy URL: " + navigation.currentEntry.url);
			assertEqual(navigation.currentEntry.url, location.href, "currentEntry.url");
			for (const u of navigation.entries().map((e) => e.url)) {
				assert(!u.includes("/~/sj/"), "history entry URL leaks: " + u);
			}
			assertEqual(typeof navigation.navigate, "function", "navigate()");
			assertEqual(typeof navigation.canGoBack, "boolean", "canGoBack");
		`,
	}),
	basicTest({
		name: "windoc-navigation-api-follows-pushstate",
		js: `
			if (typeof navigation === "undefined") { pass(); return; }
			history.pushState({}, "", "/navtest?a=1");
			assertEqual(navigation.currentEntry.url, location.href, "currentEntry follows pushState");
			assertEqual(new URL(navigation.currentEntry.url).pathname, "/navtest", "pathname");
			assert(!navigation.currentEntry.url.includes("/~/sj/"), "no proxy URL: " + navigation.currentEntry.url);
		`,
	}),
	basicTest({
		name: "windoc-matchmedia",
		js: `
			const mq = matchMedia("(min-width: 1px)");
			assertEqual(mq.matches, true, "matches");
			assertEqual(mq.media, "(min-width: 1px)", "media");
			assertEqual(typeof mq.addEventListener, "function", "addEventListener");
			assertEqual(matchMedia("(min-width: 999999px)").matches, false, "a non-matching query");
			assertEqual(typeof matchMedia("(prefers-color-scheme: dark)").matches, "boolean", "prefers-color-scheme");
			assertEqual(typeof matchMedia("(prefers-reduced-motion: reduce)").matches, "boolean", "prefers-reduced-motion");
			assertEqual(CSS.supports("display", "flex"), true, "CSS.supports");
			assertEqual(CSS.supports("display: grid"), true, "CSS.supports single-argument form");
		`,
	}),
	basicTest({
		name: "windoc-viewport-metrics",
		js: `
			assertEqual(typeof window.innerWidth, "number", "innerWidth");
			assert(window.innerWidth > 0, "innerWidth is positive");
			assertEqual(typeof window.innerHeight, "number", "innerHeight");
			assertEqual(typeof window.devicePixelRatio, "number", "devicePixelRatio");
			assertEqual(typeof screen.width, "number", "screen.width");
			assert(screen.width > 0, "screen.width is positive");
			assertEqual(typeof screen.colorDepth, "number", "screen.colorDepth");
			assertEqual(typeof visualViewport.width, "number", "visualViewport.width");
			assertEqual(typeof window.scrollY, "number", "scrollY");
			assertEqual(typeof window.scrollTo, "function", "scrollTo");
		`,
	}),
	basicTest({
		name: "windoc-graphics-contexts",
		js: `
			const cv = document.createElement("canvas");
			assert(cv.getContext("2d") !== null, "2d context");
			assertEqual(typeof (window.AudioContext || window.webkitAudioContext), "function", "AudioContext");
			assertEqual(typeof OffscreenCanvas, "function", "OffscreenCanvas");
			assert(new OffscreenCanvas(1, 1).getContext("2d") !== null, "OffscreenCanvas 2d");
			assertEqual(typeof createImageBitmap, "function", "createImageBitmap");
		`,
	}),
	basicTest({
		name: "windoc-animations",
		js: `
			const d = document.createElement("div");
			document.body.appendChild(d);
			const anim = d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 10 });
			assertEqual(typeof anim.finished, "object", "animation.finished");
			await anim.finished;
			assertEqual(d.getAnimations().length, 0, "the animation finished and cleared");
			assertEqual(typeof requestIdleCallback, "function", "requestIdleCallback");
			await new Promise((r) => requestIdleCallback(r));
		`,
	}),
	basicTest({
		name: "windoc-structured-clone-complex",
		js: `
			const obj = { m: new Map([["a", 1]]), s: new Set([1]), d: new Date(0), r: /x/g, b: new Uint8Array([1]) };
			obj.self = obj;
			const c = structuredClone(obj);
			assertEqual(c.m.get("a"), 1, "Map");
			assertEqual(c.s.has(1), true, "Set");
			assertEqual(c.d.getTime(), 0, "Date");
			assertEqual(c.r.source, "x", "RegExp");
			assertEqual(c.b[0], 1, "typed array");
			assertEqual(c.self, c, "circular reference");
		`,
	}),
];

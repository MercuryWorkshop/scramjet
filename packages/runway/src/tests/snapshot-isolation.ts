import { basicTest } from "../testcommon.ts";

// core's `_URL`, `_Map`, ... are its own routes to the builtins: what the
// page later does to `URL.prototype` or `Map.prototype` must not reach them
export default [
	basicTest({
		name: "snapshot-isolation-url-prototype",
		scramjetOnly: true,
		js: `
			const c = window[Symbol.for("scramjet client global")];
			const before = c.siteOrigin;
			const d = Object.getOwnPropertyDescriptor(URL.prototype, "origin");
			Object.defineProperty(URL.prototype, "origin", { get() { return "http://spoofed.invalid"; }, configurable: true });
			let after, proto;
			try {
				after = c.siteOrigin;
				proto = Object.getPrototypeOf(c.url) === URL.prototype;
			} finally {
				Object.defineProperty(URL.prototype, "origin", d);
			}
			assertEqual(after, before, "siteOrigin ignores the page's URL.prototype");
			assertEqual(proto, false, "the client's URL does not inherit the page's URL.prototype");
		`,
	}),
	basicTest({
		name: "snapshot-isolation-map-prototype",
		scramjetOnly: true,
		js: `
			const real = Map.prototype.get;
			let hits = 0;
			Map.prototype.get = function (...a) { hits++; return real.apply(this, a); };
			try {
				localStorage.setItem("k", "v");
				localStorage.getItem("k");
				document.body.addEventListener("x", () => {});
				fetch(location.href).catch(() => {});
			} finally {
				Map.prototype.get = real;
			}
			assertEqual(hits, 0, "core's maps don't call the page's Map.prototype.get");
		`,
	}),
];

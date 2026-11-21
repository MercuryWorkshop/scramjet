import { basicTest } from "../testcommon.ts";

// An about:blank document has no URL of its own to resolve against: it takes
// its creator's base URL, the opener's for a popup
export default [
	basicTest({
		name: "about-blank-base-popup-url-reflection",
		js: `
			const w = open("");
			assert(w, "popup blocked");
			try {
				const a = w.document.createElement("a");
				a.href = "/p";
				const img = w.document.createElement("img");
				img.src = "x.png";
				assertEqual(a.href, new URL("/p", location.href).href, "popup a.href");
				assertEqual(img.src, new URL("x.png", location.href).href, "popup img.src");
			} finally {
				w.close();
			}
		`,
	}),
	basicTest({
		name: "about-blank-base-cache-relative-url",
		scramjetOnly: true,
		js: `
			const f = document.createElement("iframe"); document.body.appendChild(f);
			const w = f.contentWindow;
			const c = await w.caches.open("blank-base");
			await c.put("/blank-entry", new w.Response("x"));
			const m = await c.match("/blank-entry");
			assert(m, "match in an about:blank frame");
			await w.caches.delete("blank-base");
		`,
	}),
];

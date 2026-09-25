import { site, page } from "./lib.ts";

export default [
	site("rv16-map-srcdoc", {
		"/a1.js": "export default 'a1';",
		"/": page(`
const f = document.createElement("iframe");
f.srcdoc = '<script type="importmap">{"imports":{"sd":"/a1.js"}}<\\/script><script type="module">import v from "sd"; parent.__st = v; import("sd").then(m => parent.__dy = m.default, e => parent.__dy = "ERR " + e.message.slice(0, 50));<\\/script>';
document.body.append(f);
for (let i = 0; i < 60 && !(window.__dy); i++) await tick(50);
c("static", window.__st || "none");
c("dyn", String(window.__dy || "none").replace(/localhost:[0-9]+/g, "HOST"));
`),
	}),
];

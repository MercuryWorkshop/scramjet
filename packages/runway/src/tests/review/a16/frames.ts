import { site, page } from "./lib.ts";

const counter = `window.__c = (window.__c || 0) + 1; export class K {}`;

export default [
	// parser-inserted map inside a same-origin iframe: the mapped module and a relative import of it must be one instance
	site("rv16-iframe-map-identity", {
		"/app.js": counter,
		"/user.js": "import { K } from './app.js'; export { K as K2 };",
		"/frame.html": `<!doctype html><html><head><script type="importmap">{"imports":{"app":"/app.js"}}</script></head><body>
<script type="module">import { K } from "app"; import { K2 } from "/user.js"; parent.__res = JSON.stringify({ same: K === K2, count: window.__c });</script></body></html>`,
		"/": page(`
const f = document.createElement("iframe"); f.src = "/frame.html"; document.body.append(f);
for (let i = 0; i < 60 && !window.__res; i++) await tick(50);
c("frame", window.__res || "none");
`),
	}),
];

import { site } from "./lib.ts";

const mapPage = (
	body: string
) => `<!doctype html><html><head><script type="importmap">{"imports":{"dep":"/dep.js","@hotwired/stimulus":"/stim.js"}}</script></head><body>
<script type="module">
${body}
</script></body></html>`;

export default [
	// re-exports from a bare specifier
	site("rv16-reexport-bare", {
		"/dep.js": "export const x = 'x'; export default 'dflt';",
		"/stim.js": "export class Controller {}",
		"/re-all.js": "export * from 'dep';",
		"/re-named.js": "export { x as y, default } from 'dep';",
		"/re-ns.js": "export * as ns from 'dep';",
		"/re-stim.js": "export { Controller } from '@hotwired/stimulus';",
		"/": mapPage(`
const t = async (s) => { try { const m = await import(s); return JSON.stringify(Object.keys(m).sort()); } catch (e) { return "ERR " + e.name + ": " + String(e.message).replace(/localhost:[0-9]+/g, "HOST").slice(0, 120); } };
runTest(async () => {
  assertConsistent("all", await t("/re-all.js"));
  assertConsistent("named", await t("/re-named.js"));
  assertConsistent("ns", await t("/re-ns.js"));
  assertConsistent("stim", await t("/re-stim.js"));
}, true);`),
	}),
	// inline module re-exporting (no-op, but must parse and load)
	site("rv16-reexport-bare-inline", {
		"/dep.js": "export const x = 'x';",
		"/stim.js": "export class Controller {}",
		"/": mapPage(`export * from "dep"; export { Controller } from "@hotwired/stimulus";
window.__ran = 1;
runTest(async () => { assertConsistent("ran", window.__ran); }, true);`),
	}),
];

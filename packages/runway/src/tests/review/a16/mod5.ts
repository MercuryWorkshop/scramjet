import { site, page } from "./lib.ts";

export default [
	// after pushState, inline modules and import() resolve against the new document URL
	site("rv16-pushstate-module-base", {
		"/deep/route/m.js": "export default 'deep';",
		"/m.js": "export default 'root';",
		"/deep/route/lazy.js": "export default 'lazy-deep';",
		"/lazy.js": "export default 'lazy-root';",
		"/": page(`
window.__r = {};
c("pre", await tryImp("./m.js"));
history.pushState(null, "", "/deep/route/page");
c("post.dyn", await tryImp("./m.js"));
const s = document.createElement("script"); s.type = "module";
s.textContent = "import d from './m.js'; window.__r.st = d; window.__r.meta = import.meta.url.replace(/localhost:[0-9]+/, 'HOST').replace(/#.*/, ''); import('./lazy.js').then(m => window.__r.lazy = m.default, e => window.__r.lazy = 'ERR');";
document.body.append(s);
for (let i = 0; i < 40 && !window.__r.lazy; i++) await tick(25);
c("post.inline.static", window.__r.st);
c("post.inline.meta", window.__r.meta);
c("post.inline.lazy", window.__r.lazy);
// the module loaded before and after the URL change must be the same instance
const a = await import("/m.js"); const b = await import(location.origin + "/m.js");
c("same", a === b);
`),
	}),
];

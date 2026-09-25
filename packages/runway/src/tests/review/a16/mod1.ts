import { site, page } from "./lib.ts";

const common = {
	"/m/app.js": "export default 'app@/m';",
	"/deep/route/m/app.js": "export default 'app@/deep/route/m';",
	"/deep/m/app.js": "export default 'app@/deep/m';",
	"/other/m/app.js": "export default 'app@/other/m';",
};

const insertMap = (json: string) =>
	`{ const s = document.createElement("script"); s.type = "importmap"; s.textContent = ${JSON.stringify(json)}; document.head.appendChild(s); }`;

export default [
	// a script-inserted map with relative addresses, resolved after the URL changed
	site("rv16-simap-pushstate-relative", {
		...common,
		"/": page(`${insertMap('{"imports":{"app":"./m/app.js","rel/":"./m/"}}')}
c("before", await tryImp("app"));
history.pushState(null, "", "/deep/route/x");
c("after.bare", await tryImp("app"));
c("after.prefix", await tryImp("rel/app.js"));
`),
	}),
	site("rv16-simap-base-change-relative", {
		...common,
		"/": page(`${insertMap('{"imports":{"app":"./m/app.js"}}')}
const b = document.createElement("base"); b.href = "/other/"; document.head.prepend(b);
c("after.base", await tryImp("app"));
`),
	}),
	// relative keys likewise
	site("rv16-simap-pushstate-relative-key", {
		...common,
		"/m/real.js": "export default 'real';",
		"/": page(`${insertMap('{"imports":{"./m/app.js":"./m/real.js"}}')}
c("before", await tryImp("./m/app.js"));
history.pushState(null, "", "/deep/route/x");
c("after.abs", await tryImp("/m/app.js"));
`),
	}),
	// several script-inserted maps: merge rules
	site("rv16-simap-merge", {
		"/a1.js": "export default 'a1';",
		"/a2.js": "export default 'a2';",
		"/b2.js": "export default 'b2';",
		"/p1/x.js": "export default 'p1x';",
		"/p2/x.js": "export default 'p2x';",
		"/p2/y/x.js": "export default 'p2yx';",
		"/": page(`${insertMap('{"imports":{"a":"/a1.js","p/":"/p1/"}}')}
${insertMap('{"imports":{"a":"/a2.js","b":"/b2.js","p/y/":"/p2/y/"}}')}
c("a", await tryImp("a"));
c("b", await tryImp("b"));
c("p/x", await tryImp("p/x.js"));
c("p/y/x", await tryImp("p/y/x.js"));
`),
	}),
	// a map inserted after the specifier was already resolved
	site("rv16-simap-after-resolve", {
		"/a1.js": "export default 'a1';",
		"/a2.js": "export default 'a2';",
		"/": page(`${insertMap('{"imports":{"a":"/a1.js"}}')}
c("first", await tryImp("a"));
${insertMap('{"imports":{"a":"/a2.js","late":"/a2.js"}}')}
c("again", await tryImp("a"));
c("late", await tryImp("late"));
`),
	}),
	// innerHTML-inserted maps are never registered
	site("rv16-simap-innerhtml-inert", {
		"/a1.js": "export default 'a1';",
		"/": page(`const d = document.createElement("div"); d.innerHTML = '<script type="importmap">{"imports":{"ih":"/a1.js"}}<\\/script>'; document.body.append(d);
c("ih", await tryImp("ih"));
`),
	}),
	// null entries, scoped packages, keys with query strings / percent-encoding
	site("rv16-simap-keys", {
		"/a1.js": "export default 'a1';",
		"/a2.js": "export default 'a2';",
		"/pkg/index.js": "export default 'pkg';",
		"/pkg/sub.js": "export default 'pkgsub';",
		"/q.js": "export default 'q-plain';",
		"/": page(`${insertMap(
			JSON.stringify({
				imports: {
					"@scope/pkg": "/pkg/index.js",
					"@scope/pkg/": "/pkg/",
					"./q.js?v=1": "/a1.js",
					"./%61b.js": "/a2.js",
					blocked: null,
					"blk/": null,
				},
			})
		)}
c("scope.pkg", await tryImp("@scope/pkg"));
c("scope.pkg.sub", await tryImp("@scope/pkg/sub.js"));
c("q.v1", await tryImp("./q.js?v=1"));
c("q.plain", await tryImp("./q.js"));
c("pct", await tryImp("./ab.js"));
c("pct2", await tryImp("./%61b.js"));
c("blocked", await tryImp("blocked"));
c("blk", await tryImp("blk/x.js"));
c("unmapped", await tryImp("nope-bare"));
`),
	}),
	// scopes in a script-inserted map, for import() from modules in the scope
	site("rv16-simap-scopes", {
		"/u-a.js": "export default 'ua';",
		"/u-b.js": "export default 'ub';",
		"/u-c.js": "export default 'uc';",
		"/s/inner.js":
			"export const load = () => import('util').then(m => m.default); import u from 'util'; export const st = u;",
		"/s/deeper/inner.js":
			"export const load = () => import('util').then(m => m.default); import u from 'util'; export const st = u;",
		"/": page(`${insertMap(JSON.stringify({ imports: { util: "/u-a.js" }, scopes: { "/s/": { util: "/u-b.js" }, "/s/deeper/": { util: "/u-c.js" } } }))}
c("top", await tryImp("util"));
const i1 = await import("/s/inner.js"); c("s.dyn", await i1.load()); c("s.static", i1.st);
const i2 = await import("/s/deeper/inner.js"); c("deep.dyn", await i2.load()); c("deep.static", i2.st);
`),
	}),
];

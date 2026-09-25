import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

export default [
	nav({
		name: "rv4-misc-pushstate-then-reload",
		routes: {
			"/": page(
				`<script>history.pushState({}, "", "/virt/route?id=3"); setTimeout(() => location.reload(), 50);</script>`
			),
			"/virt/route": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				expect(
					find(r, (x) => x.landed).href === ctx.A + "/virt/route?id=3",
					"reload after pushState"
				);
			}
		),
	}),
	nav({
		name: "rv4-misc-pushstate-then-link-relative",
		routes: {
			"/": page(
				`<a id="l" href="sibling">s</a><script>history.pushState({}, "", "/dir/page"); setTimeout(() => document.getElementById("l").click(), 50);</script>`
			),
			"/dir/sibling": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				expect(
					find(r, (x) => x.landed).href === ctx.A + "/dir/sibling",
					"relative link resolves against pushed URL"
				);
			}
		),
	}),
	nav({
		name: "rv4-misc-javascript-href",
		routes: {
			"/": page(`<a id="l" href="javascript:window.jsran = (window.jsran||0) + 1; void 0">j</a><form id="f" action="javascript:window.formjs = 1; void 0"></form><script>
				setTimeout(() => {
					document.getElementById("l").click();
					document.getElementById("f").submit();
					location.href = "javascript:window.locjs = 1; void 0";
					setTimeout(() => rep({ done: true, jsran: window.jsran, formjs: window.formjs, locjs: window.locjs }), 500);
				}, 50);
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r, ctx) => {
				const d = find(r, (x) => x.done);
				expect(d.jsran === 1, "javascript: link ran in page " + d.jsran);
				expect(d.formjs === 1, "javascript: form action " + d.formjs);
				expect(d.locjs === 1, "location = javascript: " + d.locjs);
			}
		),
	}),
	nav({
		name: "rv4-misc-svg-link-and-area",
		routes: {
			"/": page(`<svg><a id="s" href="/svgland"><rect width="10" height="10"/></a></svg><script>
				setTimeout(() => document.getElementById("s").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })), 50);
				</script>`),
			"/svgland": page(
				`<map name="m"><area id="ar" shape="rect" coords="0,0,10,10" href="/arealand"></map><script>setTimeout(() => document.getElementById("ar").click(), 50);</script>`
			),
			"/arealand": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				expect(!!req(ctx, (l) => l.url === "/svgland"), "svg link navigated");
			}
		),
	}),
	nav({
		name: "rv4-misc-dynamic-href-setters",
		routes: {
			"/": page(`<a id="l">x</a><form id="f" method="get"><input name="q" value="1"></form><script>
				const a = document.getElementById("l");
				a.href = "/x";
				a.pathname = "/set/path";
				a.search = "?s=2";
				const f = document.getElementById("f");
				f.action = "/formset";
				rep({ ahref: a.href, faction: f.action, origin: a.origin, host: a.host });
				setTimeout(() => a.click(), 50);
				</script>`),
			"/set/path": page(
				`<form id="f"><input name="q" value="1"></form><script>const f = document.getElementById("f"); f.setAttribute("action", "/formattr"); setTimeout(() => f.submit(), 50);</script>`
			),
			"/formattr": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const a = find(r, (x) => x.ahref);
				expect(
					a.ahref === ctx.A + "/set/path?s=2",
					"a.href after setters " + a.ahref
				);
				expect(a.faction === ctx.A + "/formset", "form.action " + a.faction);
				expect(a.origin === ctx.A, "a.origin " + a.origin);
				expect(
					!!req(ctx, (l) => l.url === "/set/path?s=2"),
					"navigated to set path"
				);
				expect(
					find(r, (x) => x.landed).href === ctx.A + "/formattr?q=1",
					"setAttribute action"
				);
			}
		),
	}),
	nav({
		name: "rv4-misc-navigation-api",
		routes: {
			"/": page(`<script>
				(async () => {
					if (!window.navigation) return rep({ done: true, skip: true });
					try {
						const cur = navigation.currentEntry.url;
						let intercepted = null;
						navigation.addEventListener("navigate", (e) => {
							intercepted = e.destination.url;
							if (e.canIntercept && new URL(e.destination.url).pathname === "/spa") e.intercept({ handler: async () => {} });
						});
						await navigation.navigate("/spa?x=1").finished;
						rep({ done: true, cur, intercepted, after: location.href, entry: navigation.currentEntry.url, n: navigation.entries().length });
					} catch (e) { rep({ error: String(e) }); }
				})();
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r, ctx) => {
				const d = find(r, (x) => x.done);
				if (d.skip) return;
				expect(d.cur.startsWith(ctx.A + "/"), "currentEntry.url " + d.cur);
				expect(
					d.intercepted === ctx.A + "/spa?x=1",
					"navigate event destination " + d.intercepted
				);
				expect(
					d.after === ctx.A + "/spa?x=1",
					"location after intercept " + d.after
				);
				expect(d.entry === ctx.A + "/spa?x=1", "entry url " + d.entry);
				expect(
					ctx.log.length === 1,
					"no network request " + ctx.log.map((l) => l.url)
				);
			}
		),
	}),
	nav({
		name: "rv4-misc-navigation-api-link-intercept",
		routes: {
			"/": page(`<a id="l" href="/spa2">x</a><script>
				if (window.navigation) {
					navigation.addEventListener("navigate", (e) => {
						if (e.canIntercept && new URL(e.destination.url).pathname === "/spa2") e.intercept({ handler: async () => { rep({ done: true, dest: e.destination.url, after: location.href }); } });
					});
					setTimeout(() => document.getElementById("l").click(), 50);
				} else rep({ done: true, skip: true });
				</script>`),
			"/spa2": page(
				`<script>rep({ done: true, reachedServer: true });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r, ctx) => {
				const d = find(r, (x) => x.done);
				if (d.skip) return;
				expect(
					!d.reachedServer,
					"link click not interceptable, went to server"
				);
				expect(d.dest === ctx.A + "/spa2", "dest " + d.dest);
			}
		),
	}),
	nav({
		name: "rv4-misc-iframe-self-nav-urls",
		routes: {
			"/": page(
				`<iframe id="f" src="/in1"></iframe><script>window.addEventListener("message", (e) => rep(Object.assign({ fromFrame: true }, e.data)));</script>`
			),
			"/in1": page(
				`<a id="l" href="in2?y=1">x</a><script>setTimeout(() => document.getElementById("l").click(), 50);</script>`
			),
			"/in2": page(
				`<script>parent.postMessage({ landed: true, fhref: location.href, fref: document.referrer, docurl: document.URL, base: document.baseURI }, "*");</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.fromFrame),
			(r, ctx) => {
				const d = find(r, (x) => x.fromFrame);
				expect(d.fhref === ctx.A + "/in2?y=1", "iframe location " + d.fhref);
				expect(
					d.docurl === d.fhref && d.base === d.fhref,
					"URL/baseURI " + d.docurl + " " + d.base
				);
				expect(d.fref === ctx.A + "/in1", "iframe referrer " + d.fref);
			}
		),
	}),
	nav({
		name: "rv4-misc-onsubmit-return-false-and-onclick",
		routes: {
			"/": page(`<form id="f" action="/no" onsubmit="window.sub = (window.sub||0)+1; return false"><button id="b">x</button></form><a id="a" href="/no2" onclick="window.cl = 1; return false">a</a>
				<script>addEventListener("pagehide", () => rep({ navigated: true })); setTimeout(() => { document.getElementById("b").click(); document.getElementById("a").click(); setTimeout(() => rep({ done: true, sub: window.sub, cl: window.cl }), 700); }, 50);</script>`),
			"/no": page(`<script>rep({ bad: "form" });</script>`),
			"/no2": page(`<script>rep({ bad: "link" });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done || x.bad),
			(r) => {
				expect(
					!find(r, (x) => x.bad),
					"navigated despite return false: " + (find(r, (x) => x.bad) || {}).bad
				);
				const d = find(r, (x) => x.done);
				expect(d.sub === 1 && d.cl === 1, "handlers ran");
			}
		),
	}),
];

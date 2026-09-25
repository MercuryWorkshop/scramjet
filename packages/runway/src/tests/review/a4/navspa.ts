import { nav, page, find, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

export default [
	nav({
		name: "rv4-spa-click-delegation-router",
		routes: {
			"/": page(`<nav><a id="l" href="/users/42?tab=a"><span id="s">user</span></a></nav><script>
				document.addEventListener("click", (e) => {
					const a = e.target.closest("a");
					if (!a) return;
					const u = new URL(a.href);
					if (u.origin !== location.origin || e.defaultPrevented || e.button !== 0) return;
					e.preventDefault();
					history.pushState({ p: u.pathname }, "", u.pathname + u.search);
					rep({ done: true, routed: location.pathname + location.search, hrefRead: a.href, host: a.host, pathname: a.pathname, sameOrigin: a.origin === location.origin });
				});
				addEventListener("pagehide", () => rep({ navigated: true }));
				setTimeout(() => document.getElementById("s").click(), 50);
				</script>`),
			"/users/42": page(`<script>rep({ navigated: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done || x.navigated),
			(r, ctx) => {
				expect(
					!find(r, (x) => x.navigated),
					"router did not intercept (full navigation happened)"
				);
				const d = find(r, (x) => x.done);
				expect(d.routed === "/users/42?tab=a", "routed " + d.routed);
				expect(
					d.hrefRead === ctx.A + "/users/42?tab=a",
					"a.href " + d.hrefRead
				);
				expect(d.sameOrigin, "a.origin === location.origin");
			}
		),
	}),
	nav({
		name: "rv4-spa-onclick-prop-preventdefault",
		routes: {
			"/": page(`<a id="l" href="/x">x</a><script>
				const a = document.getElementById("l");
				a.onclick = (e) => { e.preventDefault(); rep({ done: true, dp: e.defaultPrevented }); };
				addEventListener("pagehide", () => rep({ navigated: true }));
				setTimeout(() => a.click(), 50);
				</script>`),
			"/x": page(`<script>rep({ navigated: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done || x.navigated),
			(r) => {
				expect(!find(r, (x) => x.navigated), "onclick preventDefault ignored");
				expect(find(r, (x) => x.done).dp, "defaultPrevented");
			}
		),
	}),
	nav({
		name: "rv4-spa-beforeunload-prevent-and-popstate-router",
		routes: {
			"/": page(`<script>
				const views = [];
				addEventListener("popstate", (e) => { views.push(location.pathname); if (views.length === 2) rep({ done: true, views, st: history.state }); });
				history.pushState({ v: 1 }, "", "/a");
				history.pushState({ v: 2 }, "", "/b");
				setTimeout(() => history.back(), 50);
				setTimeout(() => history.back(), 300);
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r, ctx) => {
				const d = find(r, (x) => x.done);
				expect(
					d.views.join() === "/a,/",
					"popstate path sequence " + d.views.join()
				);
				expect(
					ctx.log.length === 1,
					"no requests " + ctx.log.map((l) => l.url)
				);
			}
		),
	}),
];

import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

const landed = (p: string) => (r: any[]) =>
	!!find(r, (x) => x.landed && x.path.startsWith(p));

export default [
	nav({
		name: "rv4-hist-redirect-chain",
		routes: {
			"/": page(`<script>location.href = "/r1";</script>`),
			"/r1": {
				status: 301,
				headers: {
					Location: "r2",
				},
			},
			"/r2": {
				status: 302,
				headers: {
					Location: "\${B}/r3",
					"Set-Cookie": "rc=1; Path=/",
				},
			},
			"/r3": {
				status: 307,
				headers: {
					Location: "\${A}/r4?y=1",
				},
			},
			"/r4": {
				status: 308,
				headers: {
					Location: "/final#frag",
				},
			},
			"/final": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(landed("/final"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/final#frag", "final href " + p.href);
			expect(p.cookie.includes("rc=1"), "cookie from redirect " + p.cookie);
			const f = req(ctx, (l) => l.url === "/final")!;
			expect(
				(f.headers.cookie || "").includes("rc=1"),
				"cookie sent after redirect " + f.headers.cookie
			);
			expect(p.ref === ctx.A + "/", "referrer through chain " + p.ref);
		}),
	}),
	nav({
		name: "rv4-hist-meta-refresh-and-header",
		routes: {
			"/": page(`<meta http-equiv="refresh" content="0; url=/m2?a=1">`),
			"/m2": {
				headers: {
					Refresh: "0;url=/m3",
				},
				body: "<p>m2</p>",
			},
			"/m3": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(landed("/m3"), (r, ctx) => {
			expect(!!req(ctx, (l) => l.url === "/m2?a=1"), "meta refresh target");
			expect(
				find(r, (x) => x.landed).href === ctx.A + "/m3",
				"Refresh header target"
			);
		}),
	}),
	nav({
		name: "rv4-hist-assign-replace-length",
		routes: {
			"/": page(
				`<script>rep({ h0: history.length }); setTimeout(() => location.assign("/a"), 50);</script>`
			),
			"/a": page(
				`<script>rep({ ha: history.length }); setTimeout(() => location.replace("/b"), 50);</script>`
			),
			"/b": page(`<script>rep({ landed: true, hb: history.length });</script>`),
		},
		check: chk(landed("/b"), (r) => {
			const h0 = find(r, (x) => x.h0 !== undefined).h0;
			const ha = find(r, (x) => x.ha !== undefined).ha;
			const hb = find(r, (x) => x.hb !== undefined).hb;
			expect(ha === h0 + 1, `assign adds entry ${h0}->${ha}`);
			expect(hb === ha, `replace keeps length ${ha}->${hb}`);
		}),
	}),
	nav({
		name: "rv4-hist-reload",
		routes: {
			"/": (l, ctx) => {
				const n = ctx.log.filter((x) => x.url.startsWith("/")).length;
				return page(
					`<script>if (${n} === 1) setTimeout(() => location.reload(), 50); else rep({ landed: true, n: ${n}, nav: performance.getEntriesByType("navigation")[0].type });</script>`
				);
			},
		},
		check: chk(landed("/"), (r) => {
			const p = find(r, (x) => x.landed);
			expect(p.n === 2, "reloaded once");
			expect(p.nav === "reload", "navigation type " + p.nav);
		}),
	}),
	nav({
		name: "rv4-hist-back-restores",
		routes: {
			"/": page(`<script>
				addEventListener("pageshow", (e) => {
					if (sessionStorage.rv4back === "went") { sessionStorage.rv4back = ""; rep({ landed: true, back: true, persisted: e.persisted, state: history.state, hist: history.length }); }
				});
				if (sessionStorage.rv4back !== "went") { history.replaceState({ s: 1 }, ""); setTimeout(() => { sessionStorage.rv4back = "went"; location.href = "/next"; }, 100); }
				</script>`),
			"/next": page(
				`<script>rep({ atnext: true }); setTimeout(() => history.back(), 200);</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.back),
			(r, ctx) => {
				const b = find(r, (x) => x.back);
				expect(b.path.startsWith("/"), "back to / " + b.href);
				expect(
					b.state && b.state.s === 1,
					"history.state restored " + JSON.stringify(b.state)
				);
			}
		),
	}),
	nav({
		name: "rv4-hist-pushstate-popstate",
		routes: {
			"/": page(`<script>
				history.pushState({ n: 1 }, "", "/virtual/one?x=1");
				history.pushState({ n: 2 }, "", "two");
				addEventListener("popstate", (e) => rep({ landed: true, pop: e.state, href2: location.href }));
				setTimeout(() => history.back(), 100);
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.pop !== undefined),
			(r, ctx) => {
				const p = find(r, (x) => x.pop !== undefined);
				expect(p.pop && p.pop.n === 1, "state " + JSON.stringify(p.pop));
				expect(p.href2 === ctx.A + "/virtual/one?x=1", "href " + p.href2);
				expect(
					ctx.log.length === 1,
					"no requests " + ctx.log.map((l) => l.url)
				);
			}
		),
	}),
	nav({
		name: "rv4-hist-unload-events",
		routes: {
			"/": page(`<script>
				addEventListener("beforeunload", () => navigator.sendBeacon("/report", JSON.stringify({ ev: "beforeunload" })));
				addEventListener("pagehide", (e) => navigator.sendBeacon("/report", JSON.stringify({ ev: "pagehide" })));
				addEventListener("unload", () => navigator.sendBeacon("/report", JSON.stringify({ ev: "unload" })));
				document.addEventListener("visibilitychange", () => navigator.sendBeacon("/report", JSON.stringify({ ev: "vis:" + document.visibilityState })));
				setTimeout(() => location.href = "/n", 100);
				</script>`),
			"/n": page(
				`<script>setTimeout(() => rep({ landed: true }), 500);</script>`
			),
		},
		check: chk(landed("/n"), (r) => {
			const evs = r.filter((x) => x.ev).map((x) => x.ev);
			expect(
				evs.includes("beforeunload") && evs.includes("pagehide"),
				"events " + evs.join()
			);
		}),
	}),
	nav({
		name: "rv4-hist-location-setters",
		routes: {
			"/": page(`<script>
				if (!location.search) setTimeout(() => { location.search = "?s=1"; }, 50);
				else if (location.search === "?s=1") setTimeout(() => { location.pathname = "/p/q"; }, 50);
				</script>`),
			"/p/q": page(
				`<script>if (!location.hash) { location.hash = "h"; setTimeout(() => rep({ landed: true, hash: location.hash }), 200); }</script>`
			),
		},
		check: chk(landed("/p/q"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/p/q#h", "href " + p.href);
			expect(
				ctx.log.map((l) => l.url).join() === "/,/?s=1,/p/q",
				"requests " + ctx.log.map((l) => l.url)
			);
		}),
	}),
	nav({
		name: "rv4-hist-iframe-location-and-back",
		routes: {
			"/": page(`<iframe id="f" src="/f1"></iframe><script>
				const f = document.getElementById("f");
				let loads = 0;
				f.onload = () => {
					loads++;
					try {
						const p = f.contentWindow.location.pathname;
						if (loads === 1) f.contentWindow.location.href = "/f2";
						else if (loads === 2) { rep({ at2: p }); f.src = "/f3"; }
						else if (loads === 3) rep({ landed: true, at3: p, docurl: f.contentDocument.URL, src: f.src });
					} catch (e) { rep({ error: String(e) }); }
				};
				</script>`),
			"/f1": "<p>f1</p>",
			"/f2": "<p>f2</p>",
			"/f3": "<p>f3</p>",
		},
		check: chk(
			(r) => !!find(r, (x) => x.at3),
			(r, ctx) => {
				const p = find(r, (x) => x.at3);
				expect(find(r, (x) => x.at2).at2 === "/f2", "location.href in frame");
				expect(p.at3 === "/f3", "src set " + p.at3);
				expect(p.docurl === ctx.A + "/f3", "contentDocument.URL " + p.docurl);
				expect(p.src === ctx.A + "/f3", "iframe.src reads real " + p.src);
			}
		),
	}),
];

import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

const click = (id = "l") =>
	`<script>setTimeout(() => document.getElementById(${JSON.stringify(id)}).click(), 50);</script>`;
const landing = page(`<p>landing</p><script>rep({ landed: true });</script>`);
const landed = (p: string) => (r: any[]) =>
	!!find(r, (x) => x.landed && x.path.startsWith(p));

export default [
	nav({
		name: "rv4-nav-link-relative-cookie-referer",
		routes: {
			"/": page(
				`<a id="l" href="p2?x=1">go</a><script>document.cookie = "pa=1; path=/";</script>${click()}`
			),
			"/p2": landing,
		},
		check: chk(landed("/p2"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/p2?x=1", "href " + p.href);
			expect(p.ref.startsWith(ctx.A + "/"), "document.referrer " + p.ref);
			expect(p.cookie.includes("pa=1"), "cookie on next page " + p.cookie);
			const l = req(ctx, (l) => l.url.startsWith("/p2"))!;
			expect(
				(l.headers.cookie || "").includes("pa=1"),
				"server cookie " + l.headers.cookie
			);
			expect(
				(l.headers.referer || "").startsWith(ctx.A + "/"),
				"server referer " + l.headers.referer
			);
		}),
	}),
	nav({
		name: "rv4-nav-link-absolute-crossorigin",
		routes: {
			"/": page(`<a id="l" href="\${B}/p2">go</a>${click()}`),
			"/p2": landing,
		},
		check: chk(landed("/p2"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.B + "/p2", "href " + p.href);
			expect(
				p.ref === ctx.A + "/",
				"document.referrer (origin only cross-origin) " + p.ref
			);
			const l = req(ctx, (l) => l.url === "/p2")!;
			expect(l.server === "B", "went to B");
			expect(
				l.headers.referer === ctx.A + "/",
				"server referer " + l.headers.referer
			);
		}),
	}),
	nav({
		name: "rv4-nav-link-protocol-relative",
		routes: {
			"/": page(
				`<a id="l" href="//\${B}/p2">go</a><script>document.getElementById("l").href = "//" + ${"`${B}`"}.replace("http://", "") + "/p2";</script>${click()}`
			),
			"/p2": landing,
		},
		check: chk(landed("/p2"), (r, ctx) => {
			expect(find(r, (x) => x.landed).href === ctx.B + "/p2", "href");
		}),
	}),
	nav({
		name: "rv4-nav-link-hash-and-query-only",
		routes: {
			"/": page(`<a id="h" href="#sec">h</a><a id="q" href="?q=2">q</a>
				<script>
				addEventListener("hashchange", (e) => {
					rep({ hashchange: true, hash: location.hash, newURL: e.newURL, oldURL: e.oldURL });
					setTimeout(() => document.getElementById("q").click(), 50);
				});
				rep({ start: true });
				if (location.search === "?q=2") rep({ landed: true, hist2: history.length });
				else setTimeout(() => document.getElementById("h").click(), 50);
				setTimeout(() => rep({ timeout: true }), 3000);
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed || x.timeout),
			(r, ctx) => {
				const h = find(r, (x) => x.hashchange);
				expect(!!h, "hashchange fired");
				expect(h.hash === "#sec", "hash " + h.hash);
				expect(h.newURL === ctx.A + "/#sec", "newURL " + h.newURL);
				const p = find(r, (x) => x.landed);
				expect(p.href === ctx.A + "/?q=2", "query-only href " + p.href);
				expect(
					ctx.log.filter((l) => l.url.startsWith("/")).length === 2,
					"requests: " + ctx.log.map((l) => l.url)
				);
			}
		),
	}),
	nav({
		name: "rv4-nav-link-base-href",
		routes: {
			"/": `<!doctype html><html><head><base href="/sub/dir/"></head><body><a id="l" href="p2?b=1">go</a>${click()}</body></html>`,
			"/sub/dir/p2": landing,
		},
		check: chk(landed("/sub/dir/p2"), (r, ctx) => {
			expect(
				find(r, (x) => x.landed).href === ctx.A + "/sub/dir/p2?b=1",
				"href"
			);
		}),
	}),
	nav({
		name: "rv4-nav-link-named-iframe-and-parent-top",
		routes: {
			"/": page(`<iframe name="fr" src="about:blank"></iframe><a id="l" target="fr" href="/inner">go</a>
				<script>
				window.addEventListener("message", (e) => rep({ fromInner: e.data, origin: e.origin }));
				${"setTimeout(() => document.getElementById('l').click(), 100);"}
				</script>`),
			"/inner":
				page(`<a id="p" href="/parentland" target="_parent">p</a><script>
				rep({ inner: true, isFramed: window.parent !== window, pname: window.name, parentHref: parent.location.href });
				setTimeout(() => document.getElementById("p").click(), 100);
				</script>`),
			"/parentland": page(
				`<script>rep({ landed: true, framed: window.parent !== window.top || window !== window.top ? "framed?" : "top" });</script>`
			),
		},
		check: chk(landed("/parentland"), (r, ctx) => {
			const i = find(r, (x) => x.inner);
			expect(!!i, "inner loaded in named frame");
			expect(i.pname === "fr", "window.name " + i.pname);
			expect(
				i.parentHref.startsWith(ctx.A + "/"),
				"parent href " + i.parentHref
			);
			expect(
				find(r, (x) => x.landed).href === ctx.A + "/parentland",
				"parent navigated"
			);
		}),
	}),
	nav({
		name: "rv4-nav-link-target-top-from-iframe",
		routes: {
			"/": page(`<iframe src="/inner"></iframe>`),
			"/inner": page(
				`<a id="t" href="/topland" target="_top">t</a><script>setTimeout(() => document.getElementById("t").click(), 100);</script>`
			),
			"/topland": page(
				`<script>rep({ landed: true, isTop: window === window.top });</script>`
			),
		},
		check: chk(landed("/topland"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/topland", "href " + p.href);
			expect(p.isTop, "landed as the proxied top");
		}),
	}),
	nav({
		name: "rv4-nav-link-blank-opener",
		routes: {
			"/": page(`<a id="a" href="/pop?k=plain" target="_blank">a</a><a id="b" href="/pop?k=opener" target="_blank" rel="opener">b</a><a id="c" href="/pop?k=noref" target="_blank" rel="noreferrer">c</a>
				<script>window.marker = 42; setTimeout(() => { for (const id of ["a","b","c"]) document.getElementById(id).click(); }, 100);</script>`),
			"/pop": page(`<script>
				let op; try { op = window.opener ? (window.opener.marker === 42 ? "same" : "other") : null; } catch (e) { op = "throw:" + e.message; }
				rep({ pop: new URLSearchParams(location.search).get("k"), op });
				</script>`),
		},
		check: chk(
			(r) => r.filter((x) => x.pop).length === 3,
			(r, ctx) => {
				const g = (k: string) => find(r, (x) => x.pop === k);
				expect(
					g("plain").op === null,
					"_blank implies noopener: " + g("plain").op
				);
				expect(
					g("opener").op === "same",
					"rel=opener gives opener: " + g("opener").op
				);
				expect(g("noref").ref === "", "noreferrer referrer: " + g("noref").ref);
				const l = req(ctx, (l) => l.url === "/pop?k=noref")!;
				expect(!l.headers.referer, "noreferrer header " + l.headers.referer);
				expect(
					g("plain").ref.startsWith(ctx.A + "/"),
					"plain referrer " + g("plain").ref
				);
			}
		),
	}),
	nav({
		name: "rv4-nav-link-download-no-nav",
		routes: {
			"/": page(`<a id="d1" download="x.txt">d1</a><a id="d2" href="data:text/plain,hi" download>d2</a><a id="d3" href="/file" download="f.txt">d3</a>
				<script>
				document.getElementById("d1").href = URL.createObjectURL(new Blob(["x"]));
				addEventListener("pagehide", () => rep({ unloaded: true }));
				setTimeout(() => { for (const id of ["d1","d2","d3"]) document.getElementById(id).click(); }, 100);
				setTimeout(() => rep({ still: true }), 1500);
				</script>`),
			"/file": {
				headers: {
					"Content-Type": "text/plain",
				},
				body: "file",
			},
		},
		check: chk(
			(r) => !!find(r, (x) => x.still || x.unloaded),
			(r) => {
				expect(
					!find(r, (x) => x.unloaded),
					"download links navigated the page away"
				);
			}
		),
	}),
	nav({
		name: "rv4-nav-window-open",
		routes: {
			"/": page(`<script>
				window.marker = 7;
				window.addEventListener("message", (e) => rep({ msg: e.data, origin: e.origin }));
				(async () => {
					try {
						const w = window.open("/pop", "popname");
						if (!w) return rep({ error: "window.open returned null" });
						await new Promise((res) => { const iv = setInterval(() => { try { if (w.document.readyState === "complete" && w.location.pathname === "/pop") { clearInterval(iv); res(); } } catch {} }, 50); });
						const title = w.document.title;
						const sameOpener = w.opener === window;
						const wname = w.name;
						w.location = ${"`${B}/xpop`"};
						await new Promise((r) => setTimeout(r, 1500));
						let crossBlocked = false; try { w.document.title; } catch { crossBlocked = true; }
						w.close();
						await new Promise((r) => setTimeout(r, 300));
						rep({ opened: true, title, sameOpener, wname, crossBlocked, closed: w.closed });
					} catch (e) { rep({ error: String(e) }); }
				})();
				</script>`),
			"/pop": `<!doctype html><title>POPT</title><p>pop</p>`,
			"/xpop": page(
				`<script>window.opener.postMessage("hi-from-B", "*"); rep({ xpop: true, hasOpener: !!window.opener });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.opened),
			(r, ctx) => {
				const o = find(r, (x) => x.opened);
				expect(o.title === "POPT", "w.document.title " + o.title);
				expect(o.sameOpener, "w.opener === window");
				expect(o.wname === "popname", "name " + o.wname);
				const m = find(r, (x) => x.msg);
				expect(
					!!m && m.msg === "hi-from-B",
					"postMessage back from cross-origin popup"
				);
				expect(m.origin === ctx.B, "message origin " + m.origin);
				expect(o.crossBlocked, "cross-origin popup document blocked");
				expect(o.closed, "w.closed after close()");
			}
		),
	}),
];

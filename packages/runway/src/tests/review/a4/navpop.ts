import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

export default [
	nav({
		name: "rv4-pop-open-blank-write",
		routes: {
			"/": page(`<script>
				try {
					const w = window.open("", "wr");
					if (!w) throw new Error("null");
					w.document.write("<p id=x>written</p>");
					w.document.close();
					const txt = w.document.getElementById("x").textContent;
					const href = w.location.href;
					const origin = w.origin;
					const a = w.document.createElement("a"); a.href = "/rel";
					const ahref = a.href;
					w.close();
					rep({ done: true, txt, href, origin, ahref });
				} catch (e) { rep({ error: String(e) }); }
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r, ctx) => {
				const d = find(r, (x) => x.done);
				expect(d.txt === "written", "document.write into popup");
				expect(d.href === "about:blank", "popup href " + d.href);
				expect(d.origin === ctx.A, "popup origin inherits " + d.origin);
				expect(
					d.ahref === ctx.A + "/rel",
					"relative link in about:blank popup " + d.ahref
				);
			}
		),
	}),
	nav({
		name: "rv4-pop-noopener-feature-and-reuse",
		routes: {
			"/": page(`<script>
				(async () => {
					try {
						const n = window.open("/p?k=noop", "_blank", "noopener");
						const w1 = window.open("/p?k=one", "same");
						await new Promise((r) => setTimeout(r, 800));
						const w2 = window.open("/p?k=two", "same");
						await new Promise((r) => setTimeout(r, 800));
						rep({ done: true, nullNoopener: n === null, reused: w1 === w2, w2path: (() => { try { return w2.location.pathname + w2.location.search; } catch (e) { return "throw"; } })() });
						w2.close();
					} catch (e) { rep({ error: String(e) }); }
				})();
				</script>`),
			"/p": page(
				`<script>rep({ pop: new URLSearchParams(location.search).get("k"), hasOpener: !!window.opener, wname: window.name });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(d.nullNoopener, "noopener returns null");
				expect(d.reused, "named window reused");
				expect(d.w2path === "/p?k=two", "reused window navigated " + d.w2path);
				const noop = find(r, (x) => x.pop === "noop");
				expect(!!noop && !noop.hasOpener, "noopener popup has no opener");
				const two = find(r, (x) => x.pop === "two");
				expect(
					two && two.wname === "same",
					"window.name in popup " + (two && two.wname)
				);
			}
		),
	}),
	nav({
		name: "rv4-pop-opener-navigates-parent",
		routes: {
			"/": page(
				`<script>if (!sessionStorage.rv4op) { sessionStorage.rv4op = 1; window.open("/child"); } else { sessionStorage.rv4op = ""; }</script>`
			),
			"/child": page(
				`<script>setTimeout(() => { window.opener.location = "/parentnew?z=1"; setTimeout(() => window.close(), 500); }, 200);</script>`
			),
			"/parentnew": page(
				`<script>rep({ landed: true, isTop: window === top });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const p = find(r, (x) => x.landed);
				expect(
					p.href === ctx.A + "/parentnew?z=1",
					"opener navigated " + p.href
				);
			}
		),
	}),
	nav({
		name: "rv4-pop-form-target-blank-post",
		routes: {
			"/": page(
				`<form id="f" method="post" action="/fb" target="_blank"><input name="a" value="1"></form><script>setTimeout(() => document.getElementById("f").submit(), 80);</script>`
			),
			"/fb": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const l = req(ctx, (l) => l.url === "/fb")!;
				expect(
					l.method === "POST" && l.body === "a=1",
					"post body into new window " + l.method + " " + l.body
				);
			}
		),
	}),
	nav({
		name: "rv4-pop-cookies-a-to-b",
		routes: {
			"/": {
				headers: {
					"Set-Cookie": [
						"srvck=1; Path=/",
						"srvhttp=1; Path=/; HttpOnly",
						"pathck=1; Path=/deep",
					],
				},
				body: page(
					`<script>document.cookie = "jsck=1"; setTimeout(() => location.href = "/deep/b", 50);</script>`
				),
			},
			"/deep/b": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const p = find(r, (x) => x.landed);
				for (const c of ["srvck=1", "jsck=1", "pathck=1"])
					expect(
						p.cookie.includes(c),
						"doc.cookie on B missing " + c + ": " + p.cookie
					);
				expect(!p.cookie.includes("srvhttp"), "HttpOnly hidden");
				const l = req(ctx, (l) => l.url === "/deep/b")!;
				for (const c of ["srvck=1", "jsck=1", "pathck=1", "srvhttp=1"])
					expect(
						(l.headers.cookie || "").includes(c),
						"request cookie missing " + c + ": " + l.headers.cookie
					);
			}
		),
	}),
	nav({
		name: "rv4-pop-referrer-policy-meta",
		routes: {
			"/": page(
				`<meta name="referrer" content="no-referrer"><a id="l" href="/n?x">x</a><script>setTimeout(() => document.getElementById("l").click(), 50);</script>`
			),
			"/n": page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const p = find(r, (x) => x.landed);
				expect(p.ref === "", "document.referrer with no-referrer " + p.ref);
				expect(
					!req(ctx, (l) => l.url === "/n?x")!.headers.referer,
					"Referer header sent despite no-referrer"
				);
			}
		),
	}),
	nav({
		name: "rv4-pop-history-go-multi",
		routes: {
			"/": page(`<script>
				const st = sessionStorage.rv4go || "";
				if (st === "") { sessionStorage.rv4go = "a"; location.href = "/h1"; }
				else if (st === "b") { sessionStorage.rv4go = ""; rep({ landed: true, back: true }); }
				</script>`),
			"/h1": page(`<script>location.href = "/h2";</script>`),
			"/h2": page(
				`<script>sessionStorage.rv4go = "b"; setTimeout(() => history.go(-2), 100);</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.back),
			(r, ctx) => {
				expect(find(r, (x) => x.back).path.startsWith("/"), "went back 2");
			}
		),
	}),
];

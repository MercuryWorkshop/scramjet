import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

const landing = page(
	`<p>landing</p><script>rep({ landed: true, method: document.body.dataset.m });</script>`
);
const landed = (p: string) => (r: any[]) =>
	!!find(r, (x) => x.landed && x.path.startsWith(p));
const auto = (js: string) =>
	`<script>setTimeout(() => { try { ${js} } catch (e) { rep({ error: String(e) }); } }, 80);</script>`;

export default [
	nav({
		name: "rv4-form-get-relative",
		routes: {
			"/": page(
				`<form id="f" action="search"><input name="q" value="a b&c"><input name="n" value="1"></form>${auto(`document.getElementById("f").submit()`)}`
			),
			"/search": landing,
		},
		check: chk(landed("/search"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/search?q=a+b%26c&n=1", "href " + p.href);
			const l = req(ctx, (l) => l.url.startsWith("/search"))!;
			expect(l.url === "/search?q=a+b%26c&n=1", "server url " + l.url);
		}),
	}),
	nav({
		name: "rv4-form-post-urlencoded-303",
		routes: {
			"/": page(
				`<form id="f" method="post" action="/submit"><input name="a" value="1"><input name="b" value="é x"></form><script>document.cookie="fc=1";</script>${auto(`document.getElementById("f").submit()`)}`
			),
			"/submit": (l) =>
				l.method === "POST"
					? {
							status: 303,
							headers: {
								Location: "/done?ok=1",
								"Set-Cookie": "after=2; Path=/",
							},
						}
					: "wrong method",
			"/done": landing,
		},
		check: chk(landed("/done"), (r, ctx) => {
			const s = req(ctx, (l) => l.url === "/submit")!;
			expect(s.method === "POST", "method " + s.method);
			expect(s.body === "a=1&b=%C3%A9+x", "body " + s.body);
			expect(
				(s.headers["content-type"] || "").startsWith(
					"application/x-www-form-urlencoded"
				),
				"ct " + s.headers["content-type"]
			);
			expect(
				(s.headers.cookie || "").includes("fc=1"),
				"cookie on POST " + s.headers.cookie
			);
			expect(s.headers.origin === ctx.A, "Origin header " + s.headers.origin);
			const d = req(ctx, (l) => l.url.startsWith("/done"))!;
			expect(d.method === "GET", "303 -> GET");
			const p = find(r, (x) => x.landed);
			expect(p.href === ctx.A + "/done?ok=1", "final href " + p.href);
			expect(
				p.cookie.includes("after=2"),
				"Set-Cookie on redirect visible " + p.cookie
			);
		}),
	}),
	nav({
		name: "rv4-form-post-multipart-file",
		routes: {
			"/": page(`<form id="f" method="post" enctype="multipart/form-data" action="/up"><input name="t" value="txt"><input type="file" id="file" name="file"></form>
				${auto(`const dt = new DataTransfer(); dt.items.add(new File(["FILEBODY"], "hello.txt", { type: "text/plain" })); document.getElementById("file").files = dt.files; document.getElementById("f").submit();`)}`),
			"/up": landing,
		},
		check: chk(landed("/up"), (r, ctx) => {
			const s = req(ctx, (l) => l.url === "/up")!;
			expect(s.method === "POST", "method");
			expect(
				(s.headers["content-type"] || "").startsWith(
					"multipart/form-data; boundary="
				),
				"ct " + s.headers["content-type"]
			);
			expect(
				s.body.includes('filename="hello.txt"') && s.body.includes("FILEBODY"),
				"file part " + s.body.slice(0, 300)
			);
			expect(
				s.body.includes('name="t"') && s.body.includes("txt"),
				"text part"
			);
		}),
	}),
	nav({
		name: "rv4-form-post-textplain",
		routes: {
			"/": page(
				`<form id="f" method="post" enctype="text/plain" action="/tp"><input name="a" value="1"></form>${auto(`document.getElementById("f").submit()`)}`
			),
			"/tp": landing,
		},
		check: chk(landed("/tp"), (r, ctx) => {
			const s = req(ctx, (l) => l.url === "/tp")!;
			expect(
				s.body.replace(/\r?\n$/, "") === "a=1",
				"body " + JSON.stringify(s.body)
			);
			expect((s.headers["content-type"] || "").startsWith("text/plain"), "ct");
		}),
	}),
	nav({
		name: "rv4-form-action-empty-and-missing",
		routes: {
			"/": page(`<script>location.replace("/page?x=1");</script>`),
			"/page": (l) =>
				l.method === "POST"
					? page(`<script>rep({ landed: true, posted: true });</script>`)
					: l.url.includes("q=")
						? page(
								`<script>rep({ landed: true, gotget: true }); setTimeout(() => location.replace("/page?x=1"), 200);</script>`
							)
						: page(`<form id="e" action="" method="post"><input name="p" value="1"></form><form id="m"><input name="q" value="2"></form>
							<script>
							if (sessionStorage.rv4step !== "1") { sessionStorage.rv4step = "1"; setTimeout(() => document.getElementById("m").submit(), 80); }
							else { sessionStorage.rv4step = ""; setTimeout(() => document.getElementById("e").submit(), 80); }
							</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.posted),
			(r, ctx) => {
				const g = find(r, (x) => x.gotget);
				expect(!!g, "missing action GET landed");
				expect(
					g.href === ctx.A + "/page?q=2",
					"missing action replaces query " + g.href
				);
				const p = find(r, (x) => x.posted);
				const pl = req(ctx, (l) => l.method === "POST")!;
				expect(
					pl.url === "/page?x=1",
					"empty action posts to document URL " + pl.url
				);
			}
		),
	}),
	nav({
		name: "rv4-form-button-formaction-formmethod",
		routes: {
			"/": page(`<form id="f" action="/wrong" method="get"><input name="a" value="1"><button id="b" formaction="/right?z=9" formmethod="post" name="btn" value="bv">x</button></form>
				${auto(`document.getElementById("f").requestSubmit(document.getElementById("b"))`)}`),
			"/right": landing,
			"/wrong": landing,
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const s = ctx.log[ctx.log.length - 1];
				expect(s.url === "/right?z=9", "formaction url " + s.url);
				expect(s.method === "POST", "formmethod " + s.method);
				expect(s.body === "a=1&btn=bv", "submitter value in body " + s.body);
			}
		),
	}),
	nav({
		name: "rv4-form-button-click-formtarget-iframe",
		routes: {
			"/": page(`<iframe name="sink"></iframe><form id="f" action="/intoframe" method="post"><input name="a" value="1"><button id="b" formtarget="sink">x</button></form>
				<script>window.marker = 5;</script>
				${auto(`document.getElementById("b").click(); setTimeout(() => rep({ parentStill: true, marker: window.marker }), 1500);`)}`),
			"/intoframe": page(
				`<script>rep({ landed: true, framed: window !== parent, pname: window.name });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.parentStill),
			(r, ctx) => {
				const p = find(r, (x) => x.landed);
				expect(!!p, "form landed in named iframe");
				expect(p.framed && p.pname === "sink", "in frame sink " + p.pname);
				expect(
					find(r, (x) => x.parentStill).marker === 5,
					"parent not navigated"
				);
				expect(req(ctx, (l) => l.url === "/intoframe")!.body === "a=1", "body");
			}
		),
	}),
	nav({
		name: "rv4-form-submit-event-prevent-fetch",
		routes: {
			"/": page(`<form id="f" action="/never" method="post"><input name="a" value="1"><button id="b">go</button></form>
				<script>
				let events = 0;
				document.getElementById("f").addEventListener("submit", async (e) => {
					e.preventDefault(); events++;
					const r = await fetch(e.target.action, { method: "POST", body: new FormData(e.target, e.submitter) });
					rep({ fetched: true, status: r.status, action: e.target.action, submitterIsButton: e.submitter && e.submitter.id, events });
				});
				addEventListener("pagehide", () => rep({ navigated: true }));
				</script>
				${auto(`document.getElementById("b").click()`)}`),
			"/never": (l) =>
				l.headers["x-requested"]
					? ""
					: {
							status: 200,
							headers: {
								"Content-Type": "text/plain",
							},
							body: "api",
						},
		},
		check: chk(
			(r) => !!find(r, (x) => x.fetched),
			(r, ctx) => {
				const f = find(r, (x) => x.fetched);
				expect(
					f.action === ctx.A + "/never",
					"form.action reads real URL " + f.action
				);
				expect(f.status === 200, "status");
				expect(f.submitterIsButton === "b", "e.submitter");
				const l = req(ctx, (l) => l.url === "/never")!;
				expect(
					(l.headers["content-type"] || "").startsWith("multipart/form-data"),
					"multipart " + l.headers["content-type"]
				);
				expect(!find(r, (x) => x.navigated), "preventDefault held");
			}
		),
	}),
	nav({
		name: "rv4-form-method-dialog",
		routes: {
			"/": page(`<dialog id="d"><form method="dialog"><button id="b" value="yes">ok</button></form></dialog>
				<script>
				const d = document.getElementById("d"); d.showModal();
				d.addEventListener("close", () => setTimeout(() => rep({ closed: true, rv: d.returnValue, open: d.open }), 300));
				addEventListener("pagehide", () => rep({ navigated: true }));
				</script>${auto(`document.getElementById("b").click()`)}`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.closed || x.navigated),
			(r, ctx) => {
				const c = find(r, (x) => x.closed);
				expect(
					!!c && !find(r, (x) => x.navigated),
					"dialog form navigated instead of closing"
				);
				expect(c.rv === "yes", "returnValue " + c.rv);
				expect(
					ctx.log.length === 1,
					"no extra requests " + ctx.log.map((l) => l.url)
				);
			}
		),
	}),
	nav({
		name: "rv4-form-in-iframe-get",
		routes: {
			"/": page(`<iframe src="/inner"></iframe>`),
			"/inner": page(
				`<form id="f" action="res"><input name="q" value="x"></form>${auto(`document.getElementById("f").submit()`)}`
			),
			"/res": page(
				`<script>rep({ landed: true, framed: window !== parent });</script>`
			),
		},
		check: chk(landed("/res"), (r, ctx) => {
			const p = find(r, (x) => x.landed);
			expect(p.framed, "stayed in frame");
			expect(p.href === ctx.A + "/res?q=x", "href " + p.href);
			expect(p.ref === ctx.A + "/inner", "referrer " + p.ref);
		}),
	}),
	nav({
		name: "rv4-form-post-crossorigin-307-body",
		routes: {
			"/": page(
				`<form id="f" method="post" action="\${B}/x"><input name="a" value="1"></form>${auto(`document.getElementById("f").submit()`)}`
			),
			"/x": (l) =>
				l.server === "B"
					? {
							status: 307,
							headers: {
								Location: "\${A}/y",
							},
						}
					: undefined,
			"/y": (l) => page(`<script>rep({ landed: true });</script>`),
		},
		check: chk(landed("/y"), (r, ctx) => {
			const y = req(ctx, (l) => l.url === "/y")!;
			expect(y.method === "POST", "307 keeps POST " + y.method);
			expect(y.body === "a=1", "307 keeps body " + y.body);
			const x = req(ctx, (l) => l.url === "/x")!;
			expect(x.headers.origin === ctx.A, "Origin to B " + x.headers.origin);
		}),
	}),
];

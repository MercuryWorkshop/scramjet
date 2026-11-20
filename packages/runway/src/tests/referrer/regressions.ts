import { referrerTest } from "./fixture.ts";

// Requests and init handling the referrer work has to leave as Chrome has them.

export default [
	referrerTest({
		name: "referrer-module-import-origin-is-the-document",
		js: `
		const dep = uid("dep"), mod = uid("mod");
		const body = 'import "./' + dep + '.js"; export default 1;';
		await import(rurl(XSITE, mod, { body }, ".js"));
		const all = await seenAll(dep);
		assertEqual(all.origin, MAIN, "Origin of a CDN module's static import");
		`,
	}),
	referrerTest({
		name: "referrer-post-navigation-no-referrer-origin-null",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		const id = uid("post");
		const f = document.createElement("form");
		f.action = durl(ALT, id);
		f.method = "POST";
		f.target = "fr";
		makeFrame({ name: "fr" });
		document.body.append(f);
		const report = msg(id);
		f.submit();
		await report;
		const all = await seenAll(id);
		assertEqual(all.origin, "null", "Origin of POST navigation under no-referrer");
		`,
	}),
	referrerTest({
		name: "referrer-policy-fields-combined",
		pageHeaders: { "Referrer-Policy": ["no-referrer", "unknown-token"] },
		js: `
		const id = uid("img");
		await loadEl("img", { src: rurl(MAIN, id, {}, ".png") });
		await expectRef(id, null, "no-referrer then unknown token");
		`,
	}),
	referrerTest({
		name: "referrer-sandboxed-request-referrer-is-client",
		js: `
		const id = uid("sb");
		const report = msg(id);
		makeFrame({
			sandbox: "allow-scripts",
			src: durl(MAIN, id, { js: 'report.reqref = new Request("/x", { referrer: "/chosen" }).referrer;' }),
		});
		const data = await report;
		assertEqual(data.reqref, "about:client", "sandboxed Request.referrer");
		`,
	}),
	referrerTest({
		name: "referrer-long-url-keeps-module-identity",
		js: `
		const id = uid("single");
		const url = rurl(MAIN, id, { body: "globalThis.__n = (globalThis.__n || 0) + 1; export default 1;" }, ".js");
		await import(url);
		history.pushState(null, "", "/" + "a".repeat(3900));
		await import(url);
		history.replaceState(null, "", PAGE);
		const all = await seenAll(id);
		assertEqual(globalThis.__n + "/" + all.count, "1/1", "evaluations/requests");
		`,
	}),
	referrerTest({
		name: "referrer-long-referrer-replacement-body",
		js: `
		const id = uid("nc");
		const r = new Request(rurl(MAIN, id), { method: "POST", mode: "no-cors", body: "old" });
		await r.text();
		const out = await attempt(async () => (await fetch(r, { body: "new", referrer: "/" + "b".repeat(3900) }), "ok"));
		assertEqual(out, "ok", "fetch with a replacement body");
		`,
	}),
	referrerTest({
		name: "referrer-init-headers-order-and-guard",
		js: `
		const a = new Request(location.href, { headers: [["X-Tag", "a"], ["x-tag", "b"], ["X-Tag", "c"]] }).headers.get("x-tag");
		const b = new Request(location.href, { mode: "no-cors", headers: [["Accept", "text/plain"], ["Accept", "x".repeat(129)]] }).headers.get("accept");
		assertEqual(a + " | " + b, "a, b, c | text/plain", "combined headers");
		`,
	}),
	referrerTest({
		name: "referrer-omitted-init-reads-nothing",
		js: `
		Object.prototype.method = "POST";
		let m;
		try { m = new Request(location.href).method + "," + new Request(location.href, null).method; }
		finally { delete Object.prototype.method; }
		assertEqual(m, "GET,GET", "omitted init");
		`,
	}),
	referrerTest({
		name: "referrer-origin-header-by-request-kind",
		js: `
		const out = {};
		const rec = async (k, id) => { out[k] = (await seenAll(id)).origin; };
		let id;
		id = uid("a"); await fetch(rurl(MAIN, id)); await rec("fetch-same-get", id);
		id = uid("b"); await fetch(rurl(ALT, id)); await rec("fetch-cross-get", id);
		id = uid("c"); await fetch(rurl(MAIN, id), { method: "POST", body: "x" }); await rec("fetch-same-post", id);
		id = uid("d"); await fetch(rurl(MAIN, id), { mode: "no-cors" }); await rec("fetch-same-nocors-get", id);
		id = uid("e"); await loadEl("img", { src: rurl(MAIN, id, {}, ".png"), crossorigin: "anonymous" }); await rec("img-co-same", id);
		id = uid("i"); await loadEl("img", { src: rurl(ALT, id, {}, ".png") }); await rec("img-cross", id);
		id = uid("f"); await import(rurl(MAIN, id, { body: "export default 1" }, ".js")); await rec("module-same", id);
		id = uid("g"); await xhr(rurl(MAIN, id)); await rec("xhr-same", id);
		for (const [k, sheetOrigin] of [["font-same-sheet", MAIN], ["font-cross-sheet", ALT]]) {
			const font = uid("font"), family = uid("f");
			const css = "@font-face { font-family: '" + family + "'; src: url(" + JSON.stringify(rurl(MAIN, font, {}, ".woff")) + "); }";
			await loadEl("link", { rel: "stylesheet", href: rurl(sheetOrigin, uid("sheet"), { body: css }, ".css") });
			document.fonts.load("16px '" + family + "'").catch(() => {});
			await rec(k, font);
		}
		assertEqual(JSON.stringify(out), JSON.stringify({
			"fetch-same-get": null,
			"fetch-cross-get": MAIN,
			"fetch-same-post": MAIN,
			"fetch-same-nocors-get": null,
			"img-co-same": MAIN,
			"img-cross": null,
			"module-same": MAIN,
			"xhr-same": null,
			"font-same-sheet": MAIN,
			"font-cross-sheet": MAIN,
		}), "Origin headers");
		`,
	}),
	referrerTest({
		name: "referrer-mode-override-origin",
		js: `
		const id = uid("mo");
		const r = new Request(rurl(ALT, id), { mode: "no-cors" });
		await attempt(() => fetch(r, { mode: "cors" }));
		const all = await seenAll(id);
		assertEqual(all.origin, MAIN, "Origin after overriding mode to cors");
		`,
	}),
	referrerTest({
		name: "referrer-cors-redirect-tainted-origin",
		js: `
		const final = uid("final"), hop = uid("hop");
		await attempt(() => fetch(rurl(ALT, hop, { to: rurl(XSITE, final) })));
		const all = await seenAll(final);
		assertEqual(all.origin, "null", "Origin after a cross-origin redirect");
		`,
	}),
	referrerTest({
		name: "referrer-base-inline-module-origin",
		head: '<script>document.write("<base href=\\"" + location.protocol + "//127.0.0.1:" + location.port + "/r/\\">")</script>',
		js: `
		const s = document.createElement("script");
		s.type = "module";
		s.textContent = 'import "./basedep.js";';
		document.body.append(s);
		const all = await seenAll("basedep");
		assertEqual(all.origin, MAIN, "Origin of an inline module import under a cross-origin base");
		`,
	}),
	referrerTest({
		name: "referrer-init-headers-snapshot",
		js: `
		const h = new Headers({ x: "before" });
		const r = new Request(location.href, { headers: h, get method() { h.set("x", "after"); return "GET"; } });
		assertEqual(r.headers.get("x"), "before", "headers converted at the headers member");
		`,
	}),
	referrerTest({
		name: "referrer-form-post-no-action-origin",
		js: `
		const id = uid("login");
		const second = msg(id);
		makeFrame({ src: durl(ALT, id, { js: 'if (!sessionStorage.posted) { sessionStorage.posted = 1; window.__noReport = true; const f = document.createElement("form"); f.method = "post"; document.body.append(f); f.submit(); }' }) });
		await second;
		const all = await seenAll(id);
		assertEqual(all.origin, ALT, "Origin of a form POST with no action");
		`,
	}),
	referrerTest({
		name: "referrer-srcdoc-fetch-origin",
		js: `
		const id = uid("sd");
		const f = document.createElement("iframe");
		f.srcdoc = "<script>fetch(" + JSON.stringify(rurl(XSITE, id)) + ", { credentials: 'include' }).catch(() => {})<\\/script>";
		document.body.append(f);
		const all = await seenAll(id);
		assertEqual(all.origin, MAIN, "Origin of a srcdoc's fetch");
		`,
	}),
	referrerTest({
		name: "referrer-cors-redirect-back-tainted-origin",
		js: `
		const end = uid("end"), hop = uid("hop");
		await attempt(() => fetch(rurl(ALT, hop, { to: rurl(MAIN, end) })));
		const all = await seenAll(end);
		assertEqual(all.origin, "null", "Origin after redirecting back to the initiator");
		`,
	}),
	referrerTest({
		name: "referrer-preload-as-fetch-origin",
		js: `
		const id = uid("pre");
		await loadEl("link", { rel: "preload", as: "fetch", crossorigin: "anonymous", href: rurl(MAIN, id) });
		const all = await seenAll(id);
		assertEqual(all.origin, MAIN, "Origin of a same-origin as=fetch preload");
		`,
	}),
	referrerTest({
		name: "referrer-init-headers-iterator-snapshot",
		js: `
		const h = new Headers({ x: "before" });
		const original = Headers.prototype[Symbol.iterator];
		let r;
		try {
			r = new Request(location.href, {
				headers: h,
				get method() {
					Headers.prototype[Symbol.iterator] = function* () { yield ["x", "after"]; };
					return "GET";
				},
			});
		} finally {
			Headers.prototype[Symbol.iterator] = original;
		}
		assertEqual(r.headers.get("x"), "before", "headers converted at the headers member");
		`,
	}),
	referrerTest({
		name: "referrer-data-frame-origin-null",
		js: `
		const id = uid("data");
		const f = document.createElement("iframe");
		f.src = "data:text/html," + encodeURIComponent("<script>fetch(" + JSON.stringify(rurl(MAIN, id)) + ", { credentials: 'include', referrerPolicy: 'no-referrer' }).catch(() => {})<\\/script>");
		document.body.append(f);
		const all = await seenAll(id);
		assertEqual(JSON.stringify(all.origin), JSON.stringify("null"), "Origin of a data: frame's fetch");
		`,
	}),
	referrerTest({
		name: "referrer-nocors-post-keeps-origin",
		js: `
		const id = uid("ncp");
		await fetch(rurl(MAIN, id), { method: "POST", mode: "no-cors", body: "x", referrerPolicy: "no-referrer" });
		const all = await seenAll(id);
		assertEqual(JSON.stringify(all.origin), JSON.stringify(MAIN), "Origin of a no-cors POST under no-referrer");
		`,
	}),
];

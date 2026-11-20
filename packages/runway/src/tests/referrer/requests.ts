import { fetchMatrix, POLICIES, referrerTest } from "./fixture.ts";

// Per-request referrers and referrer policies, and the requests whose
// referrer is something other than the document: stylesheets, modules and
// workers.

export default [
	referrerTest({
		name: "referrer-subresources-default",
		js: `
		const ids = {};
		for (const [tag, ext] of [["img", ".png"], ["script", ".js"], ["link", ".css"]]) {
			for (const [where, origin] of [["same", MAIN], ["alt", ALT], ["xsite", XSITE]]) {
				const id = uid(tag + where);
				ids[tag + where] = id;
				const attrs = tag === "link" ? { rel: "stylesheet", href: rurl(origin, id, {}, ext) } : { src: rurl(origin, id, {}, ext) };
				await loadEl(tag, attrs);
			}
			await expectRef(ids[tag + "same"], PAGE, tag + " same-origin");
			await expectRef(ids[tag + "alt"], MAIN + "/", tag + " cross-origin");
			await expectRef(ids[tag + "xsite"], MAIN + "/", tag + " cross-site");
		}
		`,
	}),
	referrerTest({
		name: "referrer-xhr",
		js: `
		const same = uid("same"), alt = uid("alt");
		await xhr(rurl(MAIN, same));
		await xhr(rurl(ALT, alt));
		await expectRef(same, PAGE, "same-origin xhr");
		await expectRef(alt, MAIN + "/", "cross-origin xhr");
		`,
	}),
	referrerTest({
		name: "referrer-xhr-follows-document-policy",
		pageHeaders: { "Referrer-Policy": "origin" },
		js: `
		const same = uid("same");
		await xhr(rurl(MAIN, same));
		await expectRef(same, MAIN + "/", "xhr under origin");
		`,
	}),
	referrerTest({
		name: "referrer-send-beacon",
		js: `
		const same = uid("same"), alt = uid("alt");
		navigator.sendBeacon(rurl(MAIN, same), "x");
		navigator.sendBeacon(rurl(ALT, alt), "x");
		await expectRef(same, PAGE, "same-origin beacon");
		await expectRef(alt, MAIN + "/", "cross-origin beacon");
		`,
	}),
	referrerTest({
		name: "referrer-strips-fragment",
		js: `
		location.hash = "fragment-part";
		const same = uid("same");
		await fetch(rurl(MAIN, same));
		await expectRef(same, PAGE, "fragment is never sent");
		`,
	}),
	referrerTest({
		name: "referrer-follows-history-url-changes",
		js: `
		history.pushState(null, "", "/elsewhere/pushed.html?p=2#h");
		const pushed = uid("pushed");
		await fetch(rurl(MAIN, pushed));
		await expectRef(pushed, MAIN + "/elsewhere/pushed.html?p=2", "after pushState");
		history.replaceState(null, "", "/replaced?r=3");
		const replaced = uid("replaced"), alt = uid("alt");
		await fetch(rurl(MAIN, replaced));
		await fetch(rurl(ALT, alt));
		await expectRef(replaced, MAIN + "/replaced?r=3", "after replaceState");
		await expectRef(alt, MAIN + "/", "cross-origin after replaceState");
		`,
	}),
	referrerTest({
		name: "referrer-long-url-falls-back-to-origin",
		js: `
		history.replaceState(null, "", "/long?" + "a".repeat(4200));
		const long = uid("long");
		await fetch(rurl(MAIN, long));
		await expectRef(long, MAIN + "/", "a referrer over 4096 bytes is cut to its origin");
		const fits = "/fits?" + "b".repeat(3900);
		history.replaceState(null, "", fits);
		const short = uid("short");
		await fetch(rurl(MAIN, short));
		await expectRef(short, MAIN + fits, "a referrer under 4096 bytes is sent whole");
		`,
	}),

	// fetch()'s referrerPolicy
	...POLICIES.map((policy) =>
		referrerTest({
			name: `referrer-fetch-init-policy-${policy}`,
			js: fetchMatrix(policy, JSON.stringify({ referrerPolicy: policy })),
		})
	),
	referrerTest({
		name: "referrer-fetch-init-policy-overrides-document",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		${fetchMatrix("unsafe-url", '{ referrerPolicy: "unsafe-url" }')}
		${fetchMatrix("origin", '{ referrerPolicy: "origin" }')}
		${fetchMatrix("no-referrer")}
		`,
	}),
	referrerTest({
		name: "referrer-fetch-init-unsafe-url-under-strict-document",
		pageHeaders: { "Referrer-Policy": "same-origin" },
		js: `
		${fetchMatrix("unsafe-url", '{ referrerPolicy: "unsafe-url" }')}
		${fetchMatrix("same-origin")}
		`,
	}),
	referrerTest({
		name: "referrer-fetch-init-empty-policy-uses-document",
		pageHeaders: { "Referrer-Policy": "origin" },
		js: fetchMatrix("origin", '{ referrerPolicy: "" }'),
	}),

	// fetch()'s referrer
	referrerTest({
		name: "referrer-fetch-init-referrer",
		js: `
		const custom = uid("custom"), customAlt = uid("customalt"), empty = uid("empty"), client = uid("client"), cred = uid("cred"), abs = uid("abs");
		await fetch(rurl(MAIN, custom), { referrer: "/custom/path?x=1#frag" });
		await fetch(rurl(ALT, customAlt), { referrer: "/custom/path?x=1" });
		await fetch(rurl(MAIN, empty), { referrer: "" });
		await fetch(rurl(MAIN, client), { referrer: "about:client" });
		await fetch(rurl(MAIN, abs), { referrer: MAIN + "/absolute?y=2" });
		await fetch(rurl(MAIN, cred), { referrer: MAIN.replace("//", "//user:pass@") + "/cred?c=1#f" });
		await expectRef(custom, MAIN + "/custom/path?x=1", "relative referrer");
		await expectRef(customAlt, MAIN + "/", "relative referrer, cross-origin target");
		await expectRef(empty, null, "empty referrer");
		await expectRef(client, PAGE, "about:client");
		await expectRef(abs, MAIN + "/absolute?y=2", "absolute same-origin referrer");
		await expectRef(cred, MAIN + "/cred?c=1", "credentials are stripped");
		`,
	}),
	referrerTest({
		name: "referrer-fetch-init-referrer-with-policy",
		js: `
		const a = uid("a"), b = uid("b");
		await fetch(rurl(ALT, a), { referrer: "/custom?z", referrerPolicy: "unsafe-url" });
		await fetch(rurl(MAIN, b), { referrer: "/custom?z", referrerPolicy: "origin" });
		await expectRef(a, MAIN + "/custom?z", "custom referrer under unsafe-url");
		await expectRef(b, MAIN + "/", "custom referrer under origin");
		`,
	}),
	referrerTest({
		name: "referrer-fetch-init-cross-origin-referrer",
		js: `
		const id = uid("x");
		const result = await attempt(async () => {
			await fetch(rurl(MAIN, id), { referrer: ALT + "/foreign" });
			return await seen(id);
		});
		assertConsistent("cross-origin referrer", result);
		const bad = await attempt(() => new Request("/x", { referrer: "http://[" }));
		assertEqual(bad, "threw TypeError", "an unparseable referrer throws");
		`,
	}),

	referrerTest({
		name: "referrer-init-referrer-resolves-against-base",
		js: `
		// the API base URL of a Window is its document's base URL, <base> and all
		const base = document.createElement("base");
		base.href = "/assets/";
		document.head.append(base);
		const id = uid("base");
		assertEqual(new Request("/x", { referrer: "relative" }).referrer, MAIN + "/assets/relative", "Request against <base>");
		await fetch(rurl(MAIN, id), { referrer: "relative" });
		await expectRef(id, MAIN + "/assets/relative", "fetch against <base>");
		base.remove();
		assertEqual(new Request("/x", { referrer: "relative" }).referrer, MAIN + "/page/relative", "document URL once <base> is gone");
		`,
	}),
	referrerTest({
		name: "referrer-init-referrer-conversion-order",
		js: `
		const order = [];
		const init = {
			get body() { order.push("body"); throw new Error("body"); },
			get referrer() { order.push("referrer"); return "/r"; },
		};
		const result = await attempt(() => new Request("/x", init));
		assertEqual(result, "threw Error", "the body getter's error");
		assertEqual(order.join(), "body", "referrer is not read past a throwing body");

		const read = [];
		new Request("/x", {
			get body() { read.push("body"); },
			get cache() { read.push("cache"); },
			get referrer() { read.push("referrer"); return { toString() { read.push("toString"); return "/r"; } }; },
			get referrerPolicy() { read.push("referrerPolicy"); },
		});
		assertEqual(read.join(), "body,cache,referrer,toString,referrerPolicy", "referrer is read and converted in dictionary order");
		`,
	}),
	// Request objects
	referrerTest({
		name: "referrer-request-object",
		js: `
		assertEqual(new Request("/x").referrer, "about:client", "default referrer");
		assertEqual(new Request("/x", { referrer: "" }).referrer, "", "empty referrer");
		assertEqual(new Request("/x", { referrer: "about:client" }).referrer, "about:client");
		assertEqual(new Request("/x", { referrer: "/y?z" }).referrer, MAIN + "/y?z", "relative referrer");
		assertEqual(new Request("/x", { referrer: MAIN + "/abs" }).referrer, MAIN + "/abs", "absolute referrer");
		assertConsistent("referrer with fragment", new Request("/x", { referrer: "/y#frag" }).referrer);
		assertEqual(new Request(new Request("/x", { referrer: "/copy" })).referrer, MAIN + "/copy", "copied from another Request");
		assertEqual(new Request(new Request("/x", { referrer: "/copy" }), { referrer: "" }).referrer, "", "overridden when copied");
		assertEqual(new Request("/x", { referrerPolicy: "origin" }).referrerPolicy, "origin");
		assertEqual(new Request(new Request("/x", { referrerPolicy: "origin" })).referrerPolicy, "origin");
		assertEqual(new Request("/x", { referrer: "/y" }).clone().referrer, MAIN + "/y", "clone keeps the referrer");

		const withRef = uid("withref"), noRef = uid("noref"), pol = uid("pol"), cloned = uid("cloned");
		await fetch(new Request(rurl(MAIN, withRef), { referrer: "/from-request" }));
		await fetch(new Request(rurl(MAIN, noRef), { referrer: "" }));
		await fetch(new Request(rurl(MAIN, pol), { referrerPolicy: "no-referrer" }));
		await fetch(new Request(rurl(MAIN, cloned), { referrer: "/cloned" }).clone());
		await expectRef(withRef, MAIN + "/from-request", "Request with a referrer");
		await expectRef(noRef, null, "Request with no referrer");
		await expectRef(pol, null, "Request with no-referrer");
		await expectRef(cloned, MAIN + "/cloned", "cloned Request");
		`,
	}),
	referrerTest({
		name: "referrer-request-object-in-fetch-init-override",
		js: `
		const a = uid("a"), b = uid("b");
		await fetch(new Request(rurl(MAIN, a), { referrer: "/first" }), { referrer: "/second" });
		await fetch(new Request(rurl(ALT, b), { referrerPolicy: "no-referrer" }), { referrerPolicy: "unsafe-url" });
		await expectRef(a, MAIN + "/second", "init referrer overrides the Request's");
		await expectRef(b, PAGE, "init policy overrides the Request's");
		`,
	}),
	referrerTest({
		name: "referrer-response-and-request-urls-unaffected",
		js: `
		const r = new Request("/x", { referrer: "/y" });
		assertEqual(r.url, MAIN + "/x");
		assertEqual(new Request(rurl(MAIN, "q")).referrer, "about:client");
		`,
	}),

	// element referrerpolicy attributes
	referrerTest({
		name: "referrer-element-referrerpolicy-attribute",
		js: `
		const cases = [
			["img", ".png", MAIN, "no-referrer", null],
			["img", ".png", ALT, "unsafe-url", PAGE],
			["img", ".png", MAIN, "origin", MAIN + "/"],
			["img", ".png", ALT, "same-origin", null],
			["script", ".js", MAIN, "origin", MAIN + "/"],
			["script", ".js", ALT, "unsafe-url", PAGE],
			["link", ".css", MAIN, "no-referrer", null],
			["link", ".css", ALT, "unsafe-url", PAGE],
		];
		for (const [tag, ext, origin, policy, expected] of cases) {
			const id = uid(tag);
			const url = rurl(origin, id, {}, ext);
			await loadEl(tag, tag === "link" ? { rel: "stylesheet", referrerpolicy: policy, href: url } : { referrerpolicy: policy, src: url });
			await expectRef(id, expected, tag + " referrerpolicy=" + policy);
		}
		`,
	}),
	referrerTest({
		name: "referrer-element-referrerpolicy-overrides-document",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		const a = uid("a"), b = uid("b");
		await loadEl("img", { referrerpolicy: "unsafe-url", src: rurl(ALT, a, {}, ".png") });
		await loadEl("img", { src: rurl(ALT, b, {}, ".png") });
		await expectRef(a, PAGE, "img referrerpolicy=unsafe-url under a no-referrer document");
		await expectRef(b, null, "img without the attribute");
		`,
	}),
	referrerTest({
		name: "referrer-element-referrerpolicy-property",
		js: `
		const id = uid("prop");
		await new Promise((resolve) => {
			const img = new Image();
			img.referrerPolicy = "origin";
			img.onload = img.onerror = resolve;
			img.src = rurl(MAIN, id, {}, ".png");
		});
		await expectRef(id, MAIN + "/", "img.referrerPolicy = origin");
		const img = document.createElement("img");
		img.referrerPolicy = "no-referrer";
		assertEqual(img.getAttribute("referrerpolicy"), "no-referrer", "the property reflects the attribute");
		img.setAttribute("referrerpolicy", "bogus");
		assertEqual(img.referrerPolicy, "", "an invalid value reflects as empty");
		`,
	}),
	referrerTest({
		name: "referrer-element-referrerpolicy-invalid-uses-document",
		pageHeaders: { "Referrer-Policy": "origin" },
		js: `
		const id = uid("bogus");
		await loadEl("img", { referrerpolicy: "bogus", src: rurl(MAIN, id, {}, ".png") });
		await expectRef(id, MAIN + "/", "invalid referrerpolicy falls back to the document's");
		`,
	}),

	// stylesheets are the referrer of what they load
	referrerTest({
		name: "referrer-css-external-sheet-is-referrer",
		js: `
		const img = uid("img"), sheet = uid("sheet");
		const sheetUrl = rurl(MAIN, sheet, { body: "body { background-image: url(" + rurl(MAIN, img, {}, ".png") + ") }" }, ".css");
		await loadEl("link", { rel: "stylesheet", href: sheetUrl });
		await expectRef(sheet, PAGE, "the stylesheet itself");
		await expectRef(img, sheetUrl, "an image the stylesheet loads");
		`,
	}),
	referrerTest({
		name: "referrer-css-cross-origin-sheet",
		js: `
		const img = uid("img"), sheet = uid("sheet");
		const sheetUrl = rurl(ALT, sheet, { body: "body { background-image: url(" + rurl(MAIN, img, {}, ".png") + ") }" }, ".css");
		await loadEl("link", { rel: "stylesheet", href: sheetUrl });
		await expectRef(sheet, MAIN + "/", "the cross-origin stylesheet");
		await expectRef(img, ALT + "/", "an image the cross-origin stylesheet loads from the page's origin");
		`,
	}),
	referrerTest({
		name: "referrer-css-sheet-policy-header",
		js: `
		const none = uid("none"), unsafe = uid("unsafe");
		const noneSheet = rurl(MAIN, uid("s"), { rp: "no-referrer", body: "html { background-image: url(" + rurl(MAIN, none, {}, ".png") + ") }" }, ".css");
		const unsafeSheet = rurl(MAIN, uid("s"), { rp: "unsafe-url", body: "body { background-image: url(" + rurl(ALT, unsafe, {}, ".png") + ") }" }, ".css");
		await loadEl("link", { rel: "stylesheet", href: noneSheet });
		await loadEl("link", { rel: "stylesheet", href: unsafeSheet });
		await expectRef(none, null, "sheet served with no-referrer");
		await expectRef(unsafe, unsafeSheet, "sheet served with unsafe-url");
		`,
	}),
	referrerTest({
		name: "referrer-css-import",
		js: `
		const inner = uid("inner"), img = uid("img");
		const innerUrl = rurl(MAIN, inner, { body: "body { background-image: url(" + rurl(MAIN, img, {}, ".png") + ") }" }, ".css");
		const outerUrl = rurl(MAIN, uid("outer"), { body: "@import url(" + JSON.stringify(innerUrl) + ");" }, ".css");
		await loadEl("link", { rel: "stylesheet", href: outerUrl });
		await expectRef(inner, outerUrl, "an @import's referrer is the importing sheet");
		await expectRef(img, innerUrl, "the imported sheet's image");
		`,
	}),
	referrerTest({
		name: "referrer-css-inline-uses-document",
		js: `
		const a = uid("style"), b = uid("attr");
		const style = document.createElement("style");
		style.textContent = "html { background-image: url(" + rurl(MAIN, a, {}, ".png") + ") }";
		document.head.append(style);
		const div = document.createElement("div");
		div.style.cssText = "width:10px;height:10px;background-image:url(" + rurl(MAIN, b, {}, ".png") + ")";
		document.body.append(div);
		await expectRef(a, PAGE, "<style>");
		await expectRef(b, PAGE, "style attribute");
		`,
	}),

	// module scripts are the referrer of what they import
	referrerTest({
		name: "referrer-module-imports",
		js: `
		const dep = uid("dep"), mod = uid("mod"), dyn = uid("dyn");
		const depUrl = rurl(MAIN, dep, { body: "export default 1;" }, ".js");
		const modUrl = rurl(MAIN, mod, { body: "import " + JSON.stringify(depUrl) + "; window.__modLoaded = true;" }, ".js");
		await loadEl("script", { type: "module", src: modUrl });
		await expectRef(mod, PAGE, "the module itself");
		await expectRef(dep, modUrl, "a static import");
		await import(rurl(MAIN, dyn, { body: "export default 2;" }, ".js"));
		await expectRef(dyn, PAGE, "a dynamic import from an inline script");
		`,
	}),
	referrerTest({
		name: "referrer-module-referrerpolicy-propagates",
		js: `
		const dep = uid("dep");
		const depUrl = rurl(MAIN, dep, { body: "export default 1;" }, ".js");
		const modUrl = rurl(MAIN, uid("mod"), { body: "import " + JSON.stringify(depUrl) + ";" }, ".js");
		await loadEl("script", { type: "module", referrerpolicy: "no-referrer", src: modUrl });
		await expectRef(dep, null, "the import inherits the script element's policy");
		`,
	}),

	// workers are the referrer of what they fetch
	referrerTest({
		name: "referrer-worker",
		js: `
		const worker = uid("worker"), inner = uid("inner"), innerAlt = uid("inneralt"), imported = uid("imported");
		const body = "importScripts(" + JSON.stringify(rurl(MAIN, imported, {}, ".js")) + ");" +
			"Promise.all([fetch(" + JSON.stringify(rurl(MAIN, inner)) + "), fetch(" + JSON.stringify(rurl(ALT, innerAlt)) + ")]).then(() => postMessage('done'));";
		const workerUrl = rurl(MAIN, worker, { body }, ".js");
		const w = new Worker(workerUrl);
		await workerDone(w);
		w.terminate();
		await expectRef(worker, PAGE, "the worker script");
		await expectRef(imported, workerUrl, "importScripts in the worker");
		await expectRef(inner, workerUrl, "a same-origin fetch in the worker");
		await expectRef(innerAlt, MAIN + "/", "a cross-origin fetch in the worker");
		`,
	}),
	referrerTest({
		name: "referrer-worker-policy-header",
		js: `
		const inner = uid("inner");
		const body = "fetch(" + JSON.stringify(rurl(MAIN, inner)) + ").then(() => postMessage('done'));";
		const w = new Worker(rurl(MAIN, uid("worker"), { body, rp: "no-referrer" }, ".js"));
		await workerDone(w);
		w.terminate();
		await expectRef(inner, null, "the worker's own Referrer-Policy header");
		`,
	}),
	referrerTest({
		name: "referrer-worker-policy-without-header",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		const inner = uid("inner");
		const body = "fetch(" + JSON.stringify(rurl(MAIN, inner)) + ").then(() => postMessage('done'));";
		const workerUrl = rurl(MAIN, uid("worker"), { body }, ".js");
		const w = new Worker(workerUrl);
		await workerDone(w);
		w.terminate();
		await expectRef(inner, workerUrl, "a worker served without a policy uses the default, not its creator's");
		`,
	}),
	referrerTest({
		name: "referrer-module-worker",
		js: `
		const worker = uid("worker"), dep = uid("dep");
		const depUrl = rurl(MAIN, dep, { body: "export default 1;" }, ".js");
		const body = "import " + JSON.stringify(depUrl) + "; postMessage('done');";
		const workerUrl = rurl(MAIN, worker, { body }, ".js");
		const w = new Worker(workerUrl, { type: "module" });
		await workerDone(w);
		w.terminate();
		await expectRef(worker, PAGE, "the module worker script");
		await expectRef(dep, workerUrl, "a static import in the module worker");
		`,
	}),
	referrerTest({
		name: "referrer-init-frozen",
		js: `
		const init = Object.freeze({ referrer: "/custom" });
		assertEqual(new Request("/x", init).referrer, MAIN + "/custom", "a frozen init");
		const id = uid("frozen");
		await fetch(rurl(MAIN, id), Object.freeze({ referrer: "/custom", mode: "cors", credentials: "include" }));
		await expectRef(id, MAIN + "/custom", "fetch with a frozen init");
		`,
	}),
	referrerTest({
		name: "referrer-init-referrer-keeps-the-rest",
		js: `
		class Sub extends Request {}
		const sub = new Sub("/x", { referrer: "/r" });
		assertEqual(sub instanceof Sub, true, "a subclass stays one");
		assertEqual(sub.referrer, MAIN + "/r", "a subclass's referrer");

		const controller = new AbortController();
		const r = new Request("/x", {
			method: "POST", body: "abc", referrer: "/r", referrerPolicy: "origin",
			cache: "no-store", credentials: "omit", mode: "same-origin", redirect: "manual",
			integrity: "sha256-abc", keepalive: true, headers: { "x-a": "1" },
			signal: controller.signal, window: null,
		});
		assertEqual(r.url, MAIN + "/x", "url");
		assertEqual(r.referrer, MAIN + "/r", "referrer");
		const got = [r.method, r.referrerPolicy, r.cache, r.credentials, r.mode, r.redirect, r.integrity, r.keepalive, r.headers.get("x-a")].join();
		assertEqual(got, "POST,origin,no-store,omit,same-origin,manual,sha256-abc,true,1", "the other members");
		assertEqual(await r.text(), "abc", "the body");
		controller.abort("why");
		assertEqual(r.signal.aborted && r.signal.reason, "why", "the signal");

		const copy = new Request(new Request("/x", { referrerPolicy: "no-referrer" }), { referrer: "/r" });
		assertEqual(copy.referrerPolicy, "", "an init resets the copied policy");
		assertEqual(copy.referrer, MAIN + "/r", "a copy's referrer");

		const id = uid("post");
		await fetch(rurl(MAIN, id), { method: "POST", body: "abc", referrer: "/posted" });
		await expectRef(id, MAIN + "/posted", "fetch with a body");
		`,
	}),
	referrerTest({
		name: "referrer-init-base-changed-during-conversion",
		js: `
		const base = document.createElement("base");
		base.href = "/before/";
		document.head.append(base);
		const request = new Request("/x", {
			referrer: "relative",
			get signal() {
				base.href = "/after/";
				return undefined;
			},
		});
		assertEqual(request.referrer, MAIN + "/after/relative", "resolved once the whole init is read");
		base.href = "/before/";
		const id = uid("late");
		await fetch(rurl(MAIN, id), {
			referrer: "relative",
			get signal() {
				base.href = "/after/";
				return undefined;
			},
		});
		await expectRef(id, MAIN + "/after/relative", "fetch, resolved once the whole init is read");
		base.remove();
		`,
	}),
	// a URL under the 4096 character limit is sent whole, however long the
	// proxy's own URL for it
	referrerTest({
		name: "referrer-long-document-url",
		js: `
		const doc = uid("longdoc"), inner = uid("inner");
		const js = "fetch(" + JSON.stringify(rurl(MAIN, inner)) + ").then(() => parent.postMessage({ __ref: " + JSON.stringify(doc) + ", href: location.href }, '*'));";
		const pad = "p".repeat(4050 - durl(MAIN, doc, { js, pad: "" }).length);
		const url = durl(MAIN, doc, { js, pad });
		assertEqual(url.length, 4050, "the document's URL length");
		const report = msg(doc, 2);
		makeFrame({ src: url });
		await report;
		await expectRef(inner, url, "a same-origin fetch from the long document");
		`,
	}),
	referrerTest({
		name: "referrer-long-init-referrer",
		js: `
		const long = MAIN + "/long?pad=" + "p".repeat(4050 - (MAIN + "/long?pad=").length);
		assertEqual(long.length, 4050, "the referrer's length");
		const direct = uid("direct"), req = uid("req"), cloned = uid("cloned");
		await fetch(rurl(MAIN, direct), { referrer: long });
		await fetch(new Request(rurl(MAIN, req), { referrer: long }));
		await fetch(new Request(rurl(MAIN, cloned), { method: "POST", body: "b", referrer: long }).clone());
		await expectRef(direct, long, "fetch with a long referrer");
		await expectRef(req, long, "a Request with a long referrer");
		await expectRef(cloned, long, "a cloned Request with a long referrer and a body");

		const over = MAIN + "/over?pad=" + "p".repeat(4100);
		const cut = uid("cut");
		await fetch(rurl(MAIN, cut), { referrer: over });
		await expectRef(cut, MAIN + "/", "a referrer over the limit is its origin");
		`,
	}),
	referrerTest({
		name: "referrer-init-aborted-stream-long-referrer",
		js: `
		const long = MAIN + "/long?pad=" + "p".repeat(4050 - (MAIN + "/long?pad=").length);
		const controller = new AbortController();
		controller.abort();
		const result = await Promise.race([
			attempt(() => fetch(rurl(MAIN, uid("a")), { method: "POST", body: new ReadableStream({}), duplex: "half", signal: controller.signal, referrer: long })),
			sleep(3000).then(() => "hung"),
		]);
		assertEqual(result, "threw AbortError", "an aborted fetch with a long referrer and an open stream");
		`,
	}),
	referrerTest({
		name: "referrer-init-invalid-after-conversion-keeps-body",
		js: `
		const base = document.createElement("base");
		base.href = "/ok/";
		document.head.append(base);
		const blobUrl = URL.createObjectURL(new Blob(["x"]));
		const input = new Request(MAIN + "/x", { method: "POST", body: "abc" });
		const result = await attempt(() => new Request(input, {
			referrer: "relative",
			get signal() { base.href = blobUrl; return undefined; },
		}));
		assertEqual(result, "threw TypeError", "a referrer <base> made invalid");
		assertEqual(input.bodyUsed, false, "the input's body is left alone");
		assertEqual(await input.text(), "abc", "the input's body");

		base.href = blobUrl;
		const late = new Request(MAIN + "/x", {
			referrer: "relative",
			get signal() { base.href = "/after/"; return undefined; },
		});
		assertEqual(late.referrer, MAIN + "/after/relative", "a referrer <base> made valid");
		base.remove();
		`,
	}),
	referrerTest({
		name: "referrer-long-page-oversized-init-referrer",
		js: `
		const url = MAIN + "/page/main.html?q=1&pad=";
		history.pushState(null, "", url + "p".repeat(4050 - url.length));
		const over = MAIN + "/over?pad=" + "p".repeat(4100);
		const cors = uid("cors"), nocors = uid("nocors");
		await fetch(rurl(MAIN, cors), { referrer: over });
		await fetch(rurl(MAIN, nocors), { referrer: over, mode: "no-cors" });
		await expectRef(cors, MAIN + "/", "an oversized referrer from a long page");
		await expectRef(nocors, MAIN + "/", "an oversized no-cors referrer from a long page");
		history.replaceState(null, "", PAGE);
		`,
	}),
	referrerTest({
		name: "referrer-saved-request-after-history-change",
		js: `
		const url = MAIN + "/page/main.html?q=1&pad=";
		const longA = url + "a".repeat(4050 - url.length), longB = url + "b".repeat(4050 - url.length);
		const fromLong = uid("fromlong"), fromShort = uid("fromshort"), nocors = uid("nocors"), back = uid("back");

		history.replaceState(null, "", PAGE);
		const shortReq = new Request(rurl(MAIN, fromShort));
		history.pushState(null, "", longA);
		const longReq = new Request(rurl(MAIN, fromLong));
		const noCorsReq = new Request(rurl(MAIN, nocors), { mode: "no-cors" });
		const backReq = new Request(rurl(MAIN, back));
		history.pushState(null, "", longB);
		await fetch(longReq);
		await fetch(shortReq);
		await fetch(noCorsReq);
		await expectRef(fromLong, longB, "made at one long URL, sent from another");
		await expectRef(fromShort, longB, "made at a short URL, sent from a long one");
		await expectRef(nocors, longB, "a no-cors Request made at one long URL, sent from another");
		const leaked = await (await fetch("/seen" + qs({ id: fromLong }), { cache: "no-store" })).json();
		assertEqual(leaked.scramjetHeaders.join(), "", "no header of the proxy's reaches the site");
		history.replaceState(null, "", PAGE);
		await fetch(backReq);
		await expectRef(back, PAGE, "made at a long URL, sent from a short one");
		`,
	}),
	referrerTest({
		name: "referrer-long-parent-srcdoc",
		js: `
		const doc = uid("longdoc"), img = uid("img"), fet = uid("fet");
		const js = "const f = document.createElement('iframe');" +
			"f.srcdoc = " + JSON.stringify("<img src='" + rurl(MAIN, img, {}, ".png") + "'>") + ";" +
			"f.onload = () => f.contentWindow.fetch(" + JSON.stringify(rurl(MAIN, fet)) + ");" +
			"document.body.append(f);";
		const pad = "p".repeat(4050 - durl(MAIN, doc, { js, pad: "" }).length);
		const url = durl(MAIN, doc, { js, pad });
		makeFrame({ src: url });
		await expectRef(img, url, "an image in the srcdoc of a long document");
		await expectRef(fet, url, "a fetch from the srcdoc of a long document");
		`,
	}),
	referrerTest({
		name: "referrer-fallback-header-not-forgeable",
		js: `
		const id = uid("forged");
		await fetch(rurl(MAIN, id), {
			headers: { "x-scramjet-referrer-fallback": "https://foreign.example/secret" },
			referrerPolicy: "origin",
		});
		await expectRef(id, MAIN + "/", "a page-written fallback header");
		`,
	}),
	referrerTest({
		name: "referrer-fetch-captures-state-at-call",
		js: `
		const moved = uid("moved"), policy = uid("policy");
		const pending = fetch(rurl(MAIN, moved), {});
		history.pushState(null, "", "/moved?after");
		await pending;
		history.replaceState(null, "", PAGE);
		await expectRef(moved, PAGE, "the URL at the call");

		const meta = document.createElement("meta");
		meta.name = "referrer";
		meta.content = "no-referrer";
		document.head.append(meta);
		const hidden = fetch(rurl(MAIN, policy), {});
		meta.content = "unsafe-url";
		await hidden;
		meta.remove();
		await expectRef(policy, null, "the policy at the call");
		`,
	}),
	referrerTest({
		name: "referrer-init-reads-new-target-once",
		js: `
		for (const init of [{}, { referrer: "/r" }]) {
			let reads = 0;
			const newTarget = new Proxy(function () {}, {
				get(target, key) {
					if (key === "prototype") {
						reads++;
						return Request.prototype;
					}
					return Reflect.get(target, key);
				},
			});
			Reflect.construct(Request, ["/x", init], newTarget);
			assertEqual(reads, 1, "newTarget.prototype reads with " + JSON.stringify(init));
		}
		`,
	}),
	// a stylesheet's font is the document's request - its Origin, cookies and
	// Sec-Fetch-Site are the document's - with the stylesheet as its referrer
	referrerTest({
		name: "referrer-stylesheet-font-origin",
		js: `
		for (const rp of [undefined, "origin"]) {
			const font = uid("font"), family = uid("f");
			const css = "@font-face { font-family: '" + family + "'; src: url(" + JSON.stringify(rurl(MAIN, font, {}, ".woff")) + "); }";
			await loadEl("link", { rel: "stylesheet", href: rurl(ALT, uid("sheet"), { body: css, rp }, ".css") });
			document.fonts.load("16px '" + family + "'").catch(() => {});
			const got = await seenAll(font);
			assertEqual(got.origin, MAIN, "the font's Origin, stylesheet policy " + rp);
			assertEqual(got.referer, ALT + "/", "the font's Referer, stylesheet policy " + rp);
		}
		`,
	}),
	// RequestInit is converted member by member in the order Chrome converts
	// it, each getter and toString run once and where Chrome runs it
	referrerTest({
		name: "referrer-init-conversion-matches-native",
		js: `
		const logged = (values) => {
			const log = [];
			const str = (name, v) => ({ toString() { log.push(name + ".toString"); return v; } });
			const init = new Proxy({}, {
				get(_, key) {
					log.push("get " + String(key));
					if (key === "headers") return { a: str("header", "1") };
					if (key in values) return str(String(key), values[key]);
					return undefined;
				},
			});
			return { log, init };
		};
		const full = { body: "x", cache: "no-store", credentials: "omit", integrity: "", method: "POST", mode: "cors", priority: "high", redirect: "follow", referrer: "/r", referrerPolicy: "origin" };

		const a = logged(full);
		new Request("/x", a.init);
		assertConsistent("new Request()", a.log.join());

		const b = logged(full);
		await fetch(rurl(MAIN, uid("f")), b.init);
		assertConsistent("fetch()", b.log.join());

		const c = logged({ ...full, mode: "bogus" });
		const result = await attempt(() => new Request("/x", c.init));
		assertConsistent("an invalid enum stops the conversion", [result, c.log.join()]);
		`,
	}),
	referrerTest({
		name: "referrer-init-new-target-after-conversion",
		js: `
		const log = [];
		const init = { get referrer() { log.push("referrer"); return "/r"; }, get signal() { log.push("signal"); return undefined; } };
		const newTarget = new Proxy(function () {}, {
			get(target, key) {
				if (key === "prototype") {
					log.push("prototype");
					throw new Error("prototype");
				}
				return Reflect.get(target, key);
			},
		});
		const input = new Request(MAIN + "/x", { method: "POST", body: "abc" });
		const result = await attempt(() => Reflect.construct(Request, [input, init], newTarget));
		assertConsistent("a throwing newTarget.prototype", [result, log.join()]);
		assertEqual(input.bodyUsed, false, "the input's body is left alone");
		`,
	}),
	referrerTest({
		name: "referrer-xhr-sent-after-history-change",
		js: `
		const url = MAIN + "/page/main.html?q=1&pad=";
		const longA = url + "a".repeat(4050 - url.length), longB = url + "b".repeat(4050 - url.length);
		const send = (x) => new Promise((resolve) => { x.onloadend = resolve; x.send(); });

		const fromLong = uid("fromlong"), fromShort = uid("fromshort");
		history.pushState(null, "", longA);
		const a = new XMLHttpRequest();
		a.open("GET", rurl(MAIN, fromLong));
		history.pushState(null, "", longB);
		await send(a);
		await expectRef(fromLong, longB, "opened at one long URL, sent from another");

		history.replaceState(null, "", PAGE);
		const b = new XMLHttpRequest();
		b.open("GET", rurl(MAIN, fromShort));
		history.pushState(null, "", longB);
		await send(b);
		await expectRef(fromShort, longB, "opened at a short URL, sent from a long one");
		history.replaceState(null, "", PAGE);
		`,
	}),
	referrerTest({
		name: "referrer-long-pushed-url",
		js: `
		const inner = uid("inner");
		const url = MAIN + "/page/main.html?q=1&pad=";
		history.pushState(null, "", url + "p".repeat(4050 - url.length));
		assertEqual(location.href.length, 4050, "the pushed URL's length");
		await fetch(rurl(MAIN, inner));
		await expectRef(inner, location.href, "a same-origin fetch after pushState");
		history.replaceState(null, "", PAGE);
		`,
	}),
	referrerTest({
		name: "referrer-module-no-referrer-dynamic-import",
		js: `
		const dyn = uid("dyn"), done = uid("done");
		const body = "await import(" + JSON.stringify(rurl(MAIN, dyn, { body: "export default 1;" }, ".js")) + "); window.__dynDone = true;";
		await loadEl("script", { type: "module", referrerpolicy: "no-referrer", src: rurl(MAIN, uid("mod"), { body }, ".js") });
		await expectRef(dyn, null, "a dynamic import keeps the script element's policy");
		`,
	}),
	referrerTest({
		name: "referrer-module-import-map-cross-origin",
		pageHeaders: { "Referrer-Policy": "origin" },
		js: `
		const map = document.createElement("script");
		map.type = "importmap";
		map.textContent = JSON.stringify({ imports: { "pfx/": ALT + "/r/" } });
		document.head.append(map);
		const dep = uid("dep");
		const modUrl = rurl(ALT, uid("mod"), { body: "import " + JSON.stringify("pfx/" + dep + ".js") + ";" }, ".js");
		await loadEl("script", { type: "module", src: modUrl });
		await expectRef(dep, ALT + "/", "the importing module's origin");
		`,
	}),
];

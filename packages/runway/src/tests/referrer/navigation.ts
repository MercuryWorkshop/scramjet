import { referrerTest } from "./fixture.ts";

// Navigations: the Referer header a document is requested with, and the
// document.referrer it ends up with.

export default [
	referrerTest({
		name: "referrer-iframe-navigation",
		js: `
		const same = uid("same"), alt = uid("alt"), xsite = uid("xsite");
		await expectFrame(durl(MAIN, same), same, PAGE, "same-origin iframe");
		await expectFrame(durl(ALT, alt), alt, MAIN + "/", "cross-origin iframe");
		await expectFrame(durl(XSITE, xsite), xsite, MAIN + "/", "cross-site iframe");
		`,
	}),
	referrerTest({
		name: "referrer-iframe-referrerpolicy-attribute",
		js: `
		const none = uid("none"), unsafe = uid("unsafe"), origin = uid("origin"), same = uid("same");
		await expectFrame(durl(MAIN, none), none, null, "referrerpolicy=no-referrer", { referrerpolicy: "no-referrer" });
		await expectFrame(durl(ALT, unsafe), unsafe, PAGE, "referrerpolicy=unsafe-url", { referrerpolicy: "unsafe-url" });
		await expectFrame(durl(MAIN, origin), origin, MAIN + "/", "referrerpolicy=origin", { referrerpolicy: "origin" });
		await expectFrame(durl(ALT, same), same, null, "referrerpolicy=same-origin", { referrerpolicy: "same-origin" });
		`,
	}),
	referrerTest({
		name: "referrer-iframe-src-changed",
		js: `
		const first = uid("first"), second = uid("second");
		const firstReport = msg(first);
		const f = makeFrame({ src: durl(MAIN, first) });
		await firstReport;
		const secondReport = msg(second);
		f.src = durl(ALT, second);
		const data = await secondReport;
		await expectRef(second, MAIN + "/", "iframe.src changed by the parent");
		assertEqual(data.referrer, MAIN + "/", "document.referrer after iframe.src changed");
		`,
	}),
	referrerTest({
		name: "referrer-child-navigates-itself",
		js: `
		for (const [how, origin, expectedOf] of [
			["location.href = ", MAIN, (a) => a],
			["location.assign(", MAIN, (a) => a],
			["location.replace(", ALT, () => MAIN + "/"],
			["location.href = ", XSITE, () => MAIN + "/"],
		]) {
			const next = uid("next");
			const code = how + "durl(" + JSON.stringify(origin) + ", " + JSON.stringify(next) + ")" + (how.endsWith("(") ? ")" : "");
			const first = uid("first");
			const firstUrl = durl(MAIN, first, { js: code });
			const report = msg(next);
			makeFrame({ src: firstUrl });
			const data = await report;
			const expected = expectedOf(firstUrl);
			await expectRef(next, expected, how + " from inside the frame");
			assertEqual(data.referrer, expected, how + " document.referrer");
		}
		`,
	}),
	referrerTest({
		name: "referrer-child-link-click",
		js: `
		const cases = [
			["", MAIN, (a) => a],
			[" rel=noreferrer", MAIN, () => null],
			[" referrerpolicy=origin", MAIN, () => MAIN + "/"],
			[" referrerpolicy=unsafe-url", ALT, (a) => a],
			["", ALT, () => MAIN + "/"],
		];
		for (const [attrs, origin, expectedOf] of cases) {
			const next = uid("next");
			const code = "const a = document.createElement('a'); document.body.append(a); a.outerHTML = '<a id=l" + attrs + " href=\\"' + durl(" + JSON.stringify(origin) + ", " + JSON.stringify(next) + ") + '\\">go</a>'; document.getElementById('l').click();";
			const firstUrl = durl(MAIN, uid("first"), { js: code });
			const report = msg(next);
			makeFrame({ src: firstUrl });
			const data = await report;
			const expected = expectedOf(firstUrl);
			await expectRef(next, expected, "link" + attrs + " to " + origin);
			assertEqual(data.referrer, expected ?? "", "link" + attrs + " document.referrer");
		}
		`,
	}),
	referrerTest({
		name: "referrer-parent-link-targets-frame",
		js: `
		makeFrame({ name: "target-frame" });
		for (const [attrs, expected] of [["", PAGE], [" rel='noreferrer'", null], [" referrerpolicy='origin'", MAIN + "/"]]) {
			const next = uid("next");
			const holder = document.createElement("div");
			holder.innerHTML = "<a target='target-frame'" + attrs + ">go</a>";
			const a = holder.firstChild;
			a.href = durl(MAIN, next);
			document.body.append(holder);
			const report = msg(next);
			a.click();
			const data = await report;
			await expectRef(next, expected, "parent link" + attrs);
			assertEqual(data.referrer, expected ?? "", "parent link" + attrs + " document.referrer");
		}
		`,
	}),
	referrerTest({
		name: "referrer-parent-sets-child-location",
		js: `
		const first = uid("first"), next = uid("next");
		const firstReport = msg(first);
		const f = makeFrame({ src: durl(MAIN, first) });
		await firstReport;
		const report = msg(next);
		f.contentWindow.location.href = durl(MAIN, next);
		const data = await report;
		await expectRef(next, PAGE, "parent assigning the child's location");
		assertEqual(data.referrer, PAGE, "document.referrer after the parent assigned the child's location");
		`,
	}),
	referrerTest({
		name: "referrer-form-submission",
		js: `
		makeFrame({ name: "form-target" });
		for (const [method, extra, expected] of [["get", "", PAGE], ["post", "", PAGE], ["get", " referrerpolicy=origin", null]]) {
			const next = uid("next");
			const holder = document.createElement("div");
			holder.innerHTML = "<form target='form-target' method='" + method + "'" + extra + "><input name='field' value='v'></form>";
			const form = holder.firstChild;
			form.action = durl(MAIN, next);
			document.body.append(holder);
			const report = msg(next);
			form.submit();
			const data = await report;
			const header = await seen(next);
			if (extra) {
				assertConsistent("form" + extra, [header, data.referrer]);
			} else {
				assertEqual(header, expected, method + " form Referer");
				assertEqual(data.referrer, expected, method + " form document.referrer");
			}
		}
		`,
	}),
	// a GET form's fields reach the service worker as a query it folds into
	// the URL with a redirect of its own, which the referrer has to survive
	referrerTest({
		name: "referrer-form-get-cross-origin-origin-policy",
		js: `
		const next = uid("next"), from = uid("from");
		const js = "const f = document.createElement('form'); f.method = 'get';" +
			"f.innerHTML = \\"<input name='field' value='v'>\\";" +
			"f.action = " + JSON.stringify(durl(ALT, next)) + ";" +
			"document.body.append(f); f.submit(); window.__noReport = true;";
		const report = msg(next);
		makeFrame({ src: durl(MAIN, from, { rp: "origin", js }) });
		const data = await report;
		assertEqual(await seen(next), MAIN + "/", "GET form Referer");
		assertEqual(data.referrer, MAIN + "/", "GET form document.referrer");
		`,
	}),
	// SameSite and Origin are the initiator's, which a referrer policy never
	// hides from the browser
	referrerTest({
		name: "referrer-policy-samesite-cookies",
		js: `
		document.cookie = "strict=1; SameSite=Strict; path=/";
		document.cookie = "lax=1; SameSite=Lax; path=/";
		const cookiesOf = async (id) => (await seenAll(id)).cookie || "";

		// a cross-site document under no-referrer framing this site
		const inner = uid("inner"), outer = uid("outer");
		const js = "const f = document.createElement('iframe'); f.src = " + JSON.stringify(durl(MAIN, inner)) + "; document.body.append(f); window.__noReport = true;";
		makeFrame({ src: durl(XSITE, outer, { rp: "no-referrer", js }) });
		const cross = await cookiesOf(inner);
		assertEqual(cross.includes("strict=1"), false, "no Strict cookie on a cross-site frame's navigation");

		// this site framing itself under origin
		const same = uid("same");
		const report = msg(same);
		makeFrame({ src: durl(MAIN, same) });
		await report;
		assertEqual((await cookiesOf(same)).includes("strict=1"), true, "a Strict cookie on a same-origin frame's navigation");

		document.cookie = "strict=; Max-Age=0; path=/";
		document.cookie = "lax=; Max-Age=0; path=/";
		`,
		pageHeaders: { "Referrer-Policy": "origin" },
	}),
	referrerTest({
		name: "referrer-policy-origin-header",
		js: `
		makeFrame({ name: "post-target" });
		const post = async (target, policy) => {
			const id = uid("post");
			const holder = document.createElement("div");
			holder.innerHTML = "<form target='post-target' method='post'><input name='field' value='v'></form>";
			const form = holder.firstChild;
			form.action = durl(target, id);
			if (policy) form.setAttribute("referrerpolicy", policy);
			document.body.append(holder);
			const report = msg(id);
			form.submit();
			await report;
			holder.remove();
			return (await seenAll(id)).origin;
		};
		const got = {};
		for (const [target, policy] of [[MAIN, "origin"], [MAIN, "strict-origin"], [MAIN, "no-referrer"], [ALT, "same-origin"], [ALT, "no-referrer"], [MAIN, ""]]) {
			got[(target === MAIN ? "same " : "cross ") + policy] = String(await post(target, policy)).replace(MAIN, "MAIN");
		}
		for (const [target, policy] of [[ALT, "no-referrer"], [MAIN, "no-referrer"], [ALT, "same-origin"]]) {
			const id = uid("fetch");
			await fetch(rurl(target, id), { method: "POST", body: "x", referrerPolicy: policy });
			got["fetch " + (target === MAIN ? "same " : "cross ") + policy] = String((await seenAll(id)).origin).replace(MAIN, "MAIN");
		}
		// Chrome sends the page's origin whatever the policy, never "null"
		for (const [label, origin] of Object.entries(got)) {
			assertEqual(origin, "MAIN", "Origin for a " + label + " POST");
		}
		`,
	}),
	referrerTest({
		name: "referrer-form-rel-noreferrer",
		js: `
		makeFrame({ name: "form-target" });
		const next = uid("next");
		const holder = document.createElement("div");
		holder.innerHTML = "<form target='form-target' rel='noreferrer'><input name='field' value='v'></form>";
		const form = holder.firstChild;
		form.action = durl(MAIN, next);
		document.body.append(holder);
		const report = msg(next);
		form.submit();
		const data = await report;
		assertConsistent("form rel=noreferrer", [await seen(next), data.referrer]);
		`,
	}),

	// redirects: the policy can change on the way, and a referrer that has been
	// cut down stays cut down
	referrerTest({
		name: "referrer-redirect-navigation",
		js: `
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(MAIN, hop, { to: durl(MAIN, dest) }), dest, PAGE, "same-origin redirect");
			await expectRef(hop, PAGE, "same-origin redirect hop");
		}
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(MAIN, hop, { to: durl(ALT, dest) }), dest, MAIN + "/", "redirect to cross-origin");
		}
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(ALT, hop, { to: durl(MAIN, dest) }), dest, MAIN + "/", "redirect back from cross-origin keeps the origin-only referrer");
			await expectRef(hop, MAIN + "/", "cross-origin redirect hop");
		}
		`,
	}),
	referrerTest({
		name: "referrer-redirect-navigation-policy-header",
		js: `
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(MAIN, hop, { to: durl(MAIN, dest), rp: "no-referrer" }), dest, null, "redirect with no-referrer");
		}
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(MAIN, hop, { to: durl(MAIN, dest), rp: "origin" }), dest, MAIN + "/", "redirect with origin");
		}
		{
			const hop = uid("hop"), dest = uid("dest");
			await expectFrame(rurl(MAIN, hop, { to: durl(MAIN, dest), rp: "not-a-policy" }), dest, PAGE, "redirect with an invalid policy");
		}
		`,
	}),
	// Chrome sends the Referer the redirect's policy asks for, but the
	// document's referrer is that Referer put through the navigation's
	// original policy
	referrerTest({
		name: "referrer-redirect-navigation-policy-header-document-referrer",
		js: `
		{
			const dest = uid("dest");
			await expectFrame(rurl(MAIN, uid("hop"), { to: durl(ALT, dest), rp: "unsafe-url" }), dest, PAGE, "unsafe-url redirect to cross-origin", {}, MAIN + "/");
		}
		{
			const dest = uid("dest");
			await expectFrame(rurl(MAIN, uid("hop"), { to: durl(ALT, dest), rp: "unsafe-url" }), dest, PAGE, "unsafe-url redirect under same-origin", { referrerpolicy: "same-origin" }, "");
		}
		{
			const dest = uid("dest");
			await expectFrame(rurl(MAIN, uid("hop"), { to: durl(ALT, dest), rp: "origin" }), dest, MAIN + "/", "origin redirect under unsafe-url", { referrerpolicy: "unsafe-url" });
		}
		{
			const dest = uid("dest");
			await expectFrame(rurl(MAIN, uid("hop"), { to: durl(MAIN, dest), rp: "no-referrer" }), dest, null, "no-referrer redirect under unsafe-url", { referrerpolicy: "unsafe-url" });
		}
		{
			const dest = uid("dest");
			await expectFrame(rurl(MAIN, uid("hop"), { to: rurl(MAIN, uid("hop"), { to: durl(ALT, dest) }), rp: "unsafe-url" }), dest, PAGE, "unsafe-url on the first of two redirects", {}, MAIN + "/");
		}
		`,
	}),
	referrerTest({
		name: "referrer-redirect-navigation-multi-hop",
		js: `
		const a = uid("a"), b = uid("b"), dest = uid("dest");
		const url = rurl(MAIN, a, { to: rurl(ALT, b, { to: durl(MAIN, dest) }) });
		await expectFrame(url, dest, MAIN + "/", "MAIN -> ALT -> MAIN");
		await expectRef(a, PAGE, "first hop");
		await expectRef(b, MAIN + "/", "second hop");
		`,
	}),
	referrerTest({
		name: "referrer-redirect-fetch",
		js: `
		const cases = [
			[(d) => rurl(MAIN, uid("h"), { to: rurl(MAIN, d) }), PAGE, "same-origin"],
			[(d) => rurl(MAIN, uid("h"), { to: rurl(ALT, d) }), MAIN + "/", "to cross-origin"],
			[(d) => rurl(ALT, uid("h"), { to: rurl(MAIN, d) }), MAIN + "/", "back from cross-origin"],
			[(d) => rurl(MAIN, uid("h"), { to: rurl(MAIN, d), rp: "no-referrer" }), null, "no-referrer on the redirect"],
			[(d) => rurl(MAIN, uid("h"), { to: rurl(ALT, d), rp: "unsafe-url" }), PAGE, "unsafe-url on the redirect"],
			[(d) => rurl(MAIN, uid("h"), { to: rurl(MAIN, d), rp: "strict-origin" }), MAIN + "/", "strict-origin on the redirect"],
			[(d) => rurl(MAIN, uid("h"), { to: rurl(ALT, uid("h"), { to: rurl(MAIN, d), rp: "unsafe-url" }) }), MAIN + "/", "unsafe-url cannot restore a cut referrer"],
		];
		for (const [make, expected, label] of cases) {
			const dest = uid("dest");
			await fetch(make(dest));
			await expectRef(dest, expected, "fetch redirect " + label);
		}
		`,
	}),
	referrerTest({
		name: "referrer-redirect-fetch-init-policy",
		js: `
		const dest = uid("dest"), dest2 = uid("dest2");
		await fetch(rurl(MAIN, uid("h"), { to: rurl(ALT, dest) }), { referrerPolicy: "unsafe-url" });
		await fetch(rurl(MAIN, uid("h"), { to: rurl(ALT, dest2), rp: "no-referrer" }), { referrerPolicy: "unsafe-url" });
		await expectRef(dest, PAGE, "the request's own policy carries through the redirect");
		await expectRef(dest2, null, "the redirect's policy replaces the request's");
		`,
	}),
	referrerTest({
		name: "referrer-redirect-image",
		js: `
		const dest = uid("dest"), dest2 = uid("dest2");
		await loadEl("img", { src: rurl(ALT, uid("h"), { to: rurl(MAIN, dest, {}, ".png") }) });
		await loadEl("img", { src: rurl(MAIN, uid("h"), { to: rurl(ALT, dest2, {}, ".png") }) });
		await expectRef(dest, MAIN + "/", "img redirected back from cross-origin");
		await expectRef(dest2, MAIN + "/", "img redirected to cross-origin");
		`,
	}),

	// documents inside documents
	referrerTest({
		name: "referrer-nested-frames",
		js: `
		const inner = uid("inner"), innerMain = uid("innermain");
		const code = "const f = document.createElement('iframe'); f.src = durl(ALT, " + JSON.stringify(inner) + "); document.body.append(f);" +
			"const g = document.createElement('iframe'); g.src = durl(MAIN, " + JSON.stringify(innerMain) + "); document.body.append(g);";
		const middleUrl = durl(ALT, uid("middle"), { js: code });
		makeFrame({ src: middleUrl });
		await expectRef(inner, middleUrl, "same-origin grandchild");
		await expectRef(innerMain, ALT + "/", "cross-origin grandchild");
		`,
	}),
	referrerTest({
		name: "referrer-nested-frames-document-referrer",
		js: `
		const inner = uid("inner");
		// the grandchild's document posts to its parent; the middle frame relays
		const code = "addEventListener('message', (e) => { if (e.data && e.data.__ref) parent.postMessage(e.data, '*'); });" +
			"const f = document.createElement('iframe'); f.src = durl(ALT, " + JSON.stringify(inner) + "); document.body.append(f);";
		const middleUrl = durl(ALT, uid("middle"), { js: code });
		const report = msg(inner);
		makeFrame({ src: middleUrl });
		const data = await report;
		assertEqual(data.referrer, middleUrl, "the grandchild's document.referrer is the middle frame");
		`,
	}),
	referrerTest({
		name: "referrer-srcdoc-iframe",
		js: `
		const img = uid("img"), fr = uid("fr");
		const report = new Promise((resolve) => addEventListener("message", (e) => e.data && e.data.srcdoc && resolve(e.data)));
		makeFrame({ srcdoc: "<img src='" + rurl(MAIN, img, {}, ".png") + "'><iframe src='" + durl(ALT, fr) + "'></iframe><script>parent.postMessage({ srcdoc: true, referrer: document.referrer }, '*')<\\/script>" });
		const data = await report;
		assertConsistent("srcdoc document.referrer", data.referrer);
		await expectRef(img, PAGE, "a srcdoc document's subresource uses its parent's URL");
		await expectRef(fr, MAIN + "/", "a srcdoc document's iframe uses its parent's URL");
		`,
	}),
	referrerTest({
		name: "referrer-srcdoc-inherits-policy",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		const img = uid("img");
		const done = new Promise((resolve) => addEventListener("message", (e) => e.data === "srcdoc-loaded" && resolve()));
		makeFrame({ srcdoc: "<img src='" + rurl(MAIN, img, {}, ".png") + "' onload='parent.postMessage(\\"srcdoc-loaded\\", \\"*\\")' onerror='parent.postMessage(\\"srcdoc-loaded\\", \\"*\\")'>" });
		await done;
		await expectRef(img, null, "a srcdoc document inherits its parent's policy");
		`,
	}),
	referrerTest({
		name: "referrer-about-blank-iframe",
		js: `
		const f = makeFrame({});
		assertConsistent("initial about:blank document.referrer", f.contentDocument.referrer === PAGE ? "PAGE" : f.contentDocument.referrer);
		const img = uid("img");
		await loadEl("img", { src: rurl(MAIN, img, {}, ".png") }, f.contentDocument.body);
		assertConsistent("initial about:blank subresource", (await seen(img)) === PAGE ? "PAGE" : await seen(img));
		const g = makeFrame({ src: "about:blank" });
		assertConsistent("about:blank document.referrer", g.contentDocument.referrer === PAGE ? "PAGE" : g.contentDocument.referrer);
		const fetched = uid("fetched");
		await g.contentWindow.fetch(rurl(MAIN, fetched));
		assertConsistent("about:blank frame's fetch", (await seen(fetched)) === PAGE ? "PAGE" : await seen(fetched));
		`,
	}),
	referrerTest({
		name: "referrer-about-blank-iframe-inherits-policy",
		pageHeaders: { "Referrer-Policy": "origin" },
		js: `
		const f = makeFrame({});
		const img = uid("img");
		await loadEl("img", { src: rurl(MAIN, img, {}, ".png") }, f.contentDocument.body);
		assertConsistent("about:blank subresource under origin", await seen(img));
		`,
	}),
	referrerTest({
		name: "referrer-data-url-iframe",
		js: `
		const img = uid("img");
		const report = new Promise((resolve) => addEventListener("message", (e) => e.data && e.data.dataurl && resolve(e.data)));
		makeFrame({ src: "data:text/html," + encodeURIComponent("<img src='" + rurl(MAIN, img, {}, ".png") + "'><script>parent.postMessage({ dataurl: true, referrer: document.referrer }, '*')<\\/script>") });
		const data = await report;
		assertEqual(data.referrer, MAIN + "/", "a data: document is cross-origin to its parent");
		await expectRef(img, null, "a data: document's subresources carry no referrer");
		`,
	}),
	referrerTest({
		name: "referrer-blob-url-iframe",
		js: `
		const img = uid("img");
		const html = "<img src='" + rurl(MAIN, img, {}, ".png") + "'><script>parent.postMessage({ bloburl: true, referrer: document.referrer }, '*')<\\/script>";
		const report = new Promise((resolve) => addEventListener("message", (e) => e.data && e.data.bloburl && resolve(e.data)));
		makeFrame({ src: URL.createObjectURL(new Blob([html], { type: "text/html" })) });
		const data = await report;
		assertEqual(data.referrer, PAGE, "blob: document.referrer");
		await expectRef(img, null, "a blob: document's subresources carry no referrer");
		`,
	}),
	referrerTest({
		name: "referrer-document-written-frame",
		js: `
		const f = makeFrame({});
		const img = uid("img");
		f.contentDocument.open();
		f.contentDocument.write("<img src='" + rurl(MAIN, img, {}, ".png") + "'>");
		f.contentDocument.close();
		assertConsistent("document.write frame's subresource", await seen(img));
		assertConsistent("document.write frame's document.referrer", f.contentDocument.referrer);
		`,
	}),

	// document.referrer survives what doesn't navigate
	referrerTest({
		name: "referrer-document-referrer-after-pushstate",
		js: `
		const id = uid("doc");
		const code = "history.pushState(null, '', '/pushed?x'); report.after = document.referrer;";
		const { doc, data } = await frameRef(durl(MAIN, id, { js: code }), id);
		assertEqual(doc, PAGE, "document.referrer");
		assertEqual(data.after, PAGE, "document.referrer is unchanged by pushState");
		`,
	}),
	referrerTest({
		name: "referrer-document-referrer-after-reload",
		js: `
		const id = uid("doc");
		const code = "const k = 'reload-' + report.__ref; const n = (+sessionStorage.getItem(k) || 0) + 1; sessionStorage.setItem(k, n); report.n = n; if (n === 1) { window.__noReport = true; location.reload(); }";
		const url = durl(MAIN, id, { js: code });
		const second = msg(id);
		makeFrame({ src: url });
		const data = await second;
		assertEqual(data.n, 2, "the report comes from the reloaded document");
		const name = (v) => v === url ? "self" : v === PAGE ? "PAGE" : v;
		assertConsistent("document.referrer after reload", name(data.referrer));
		assertConsistent("Referer of the reload", name(await seen(id)));
		`,
	}),
	referrerTest({
		name: "referrer-document-referrer-after-history-back",
		js: `
		const id = uid("doc"), other = uid("other");
		const back = durl(ALT, other, { js: "window.__noReport = true; addEventListener('load', () => setTimeout(() => history.back(), 50));" });
		const code = "const k = 'back-' + report.__ref; const n = (+sessionStorage.getItem(k) || 0) + 1; sessionStorage.setItem(k, n); report.n = n; if (n === 1) { window.__noReport = true; addEventListener('load', () => setTimeout(() => (location.href = " + JSON.stringify(back) + "), 50)); }";
		const report = msg(id);
		makeFrame({ src: durl(MAIN, id, { js: code }) });
		const data = await report;
		assertEqual(data.n, 2, "the report comes from the document navigated back to");
		assertEqual(data.referrer, PAGE, "document.referrer after history.back()");
		`,
	}),
	referrerTest({
		name: "referrer-meta-refresh",
		js: `
		const next = uid("next");
		const head = "<meta http-equiv='refresh' content='0; url=" + durl(MAIN, next) + "'>";
		const firstUrl = durl(MAIN, uid("first"), { head });
		const report = msg(next);
		makeFrame({ src: firstUrl });
		const data = await report;
		const header = await seen(next);
		assertConsistent("meta refresh Referer", header === firstUrl ? "refreshing document" : header);
		assertConsistent("meta refresh document.referrer", data.referrer === firstUrl ? "refreshing document" : data.referrer);
		`,
	}),
	// review/1-regressions.md #9: a frame or popup answering its embedder at
	// document.referrer's origin, which threw while document.referrer was ""
	referrerTest({
		name: "referrer-postmessage-to-document-referrer",
		js: `
		const reply = (tag) => "(window.opener || parent).postMessage({ reply: " + JSON.stringify(tag) + " }, document.referrer);";
		const replied = (tag) => new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("no reply from the " + tag)), 8000);
			addEventListener("message", (e) => {
				if (e.data && e.data.reply === tag) { clearTimeout(timer); resolve(e.origin); }
			});
		});
		for (const [tag, origin] of [["same-origin frame", MAIN], ["cross-origin frame", ALT], ["cross-site frame", XSITE]]) {
			const got = replied(tag);
			const id = uid("f");
			makeFrame({ src: durl(origin, id, { js: reply(tag) }) });
			assertEqual(await got, origin, tag + " reply origin");
			const { error } = await msg(id).catch(() => ({}));
			assert(!error, tag + " threw: " + error);
		}
		const got = replied("popup");
		const w = window.open(durl(ALT, uid("p"), { js: reply("popup") }), "_blank");
		assertEqual(await got, ALT, "popup reply origin");
		w.close();
		`,
	}),
	referrerTest({
		name: "referrer-window-open",
		js: `
		const id = uid("popup"), none = uid("none");
		const report = msg(id);
		const w = window.open(durl(MAIN, id), "_blank");
		const data = await report;
		w.close();
		await expectRef(id, PAGE, "window.open Referer");
		assertEqual(data.referrer, PAGE, "window.open document.referrer");

		const w2 = window.open(durl(MAIN, none), "_blank", "noreferrer");
		await expectRef(none, null, "window.open with noreferrer");
		assertEqual(w2, null, "noreferrer implies noopener");
		`,
	}),
];

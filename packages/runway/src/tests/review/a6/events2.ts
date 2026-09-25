import { basicTest, htmlTest, type Test } from "../../../testcommon.ts";

const t = (name: string, js: string) =>
	basicTest({
		name: "rv6-ev2-" + name,
		js,
	});

export default [
	htmlTest({
		name: "rv6-ev2-body-onmessage-attr",
		html: `<!doctype html><body onmessage="window.__d = event.data; window.__o = event.origin;"><script>
			runTest(async () => {
				postMessage({ a: 1 }, "*");
				await new Promise(r => setTimeout(r, 100));
				assertEqual(JSON.stringify(window.__d), '{"a":1}', "attr handler data");
				assertEqual(window.__o, location.origin);
			});
		</script></body>`,
	}),
	t(
		"setattr-onmessage",
		`
		document.body.setAttribute("onmessage", "window.__d2 = event.data");
		postMessage("z", "*");
		await new Promise(r => setTimeout(r, 100));
		assertEqual(window.__d2, "z");
		document.body.removeAttribute("onmessage");
	`
	),
	t(
		"wrapped-event-setters",
		`
		await new Promise((res, rej) => {
			addEventListener("message", (e) => {
				try {
					e.returnValue = false;
					e.cancelBubble = true;
					assertEqual(e.defaultPrevented, false, "message not cancelable");
					res();
				} catch (x) { rej(x); }
			}, { once: true });
			postMessage("s", "*");
		});
	`
	),
	t(
		"storage-event-other-frame",
		`
		const f = document.createElement("iframe");
		f.src = location.href.replace(/[^/]*$/, "") + "nothing-here";
		document.body.appendChild(f);
		await new Promise(r => f.onload = r);
		const p = new Promise((res) => f.contentWindow.addEventListener("storage", (e) => res(e)));
		localStorage.setItem("rv6k", "v1");
		const e = await p;
		assertEqual(e.key, "rv6k", "key unprefixed");
		assertEqual(e.newValue, "v1");
		assertEqual(e.url, location.href, "url");
		localStorage.removeItem("rv6k");
	`
	),
	t(
		"storage-event-clear",
		`
		const f = document.createElement("iframe");
		f.src = location.href.replace(/[^/]*$/, "") + "nothing-here";
		document.body.appendChild(f);
		await new Promise(r => f.onload = r);
		localStorage.setItem("rv6c", "1");
		const got = [];
		f.contentWindow.addEventListener("storage", (e) => got.push(e.key));
		localStorage.clear();
		await new Promise(r => setTimeout(r, 200));
		assert(got.length >= 1, "clear produced events: " + JSON.stringify(got));
	`
	),
	t(
		"listener-throw-reports",
		`
		const errs = [];
		const onerr = (e) => { errs.push(e.message); e.preventDefault(); };
		addEventListener("error", onerr);
		const h = { handleEvent: 5 };
		document.body.addEventListener("click", h);
		document.body.click();
		document.body.removeEventListener("click", h);
		removeEventListener("error", onerr);
		assertEqual(errs.length, 1, "non-callable handleEvent reports one error");
		assert(/handleEvent|not a function/.test(errs[0]), errs[0]);
	`
	),
	t(
		"handleEvent-reassigned",
		`
		const out = [];
		const h = { handleEvent() { out.push(1); } };
		document.body.addEventListener("click", h);
		document.body.click();
		h.handleEvent = () => out.push(2);
		document.body.click();
		document.body.removeEventListener("click", h);
		document.body.click();
		assertEqual(out.join(","), "1,2");
	`
	),
	t(
		"listener-cross-realm-remove",
		`
		const f = document.createElement("iframe"); document.body.appendChild(f);
		const w = f.contentWindow;
		let n = 0; const fn = () => n++;
		EventTarget.prototype.addEventListener.call(w, "rv6x", fn);
		w.removeEventListener("rv6x", fn);
		w.dispatchEvent(new w.Event("rv6x"));
		assertEqual(n, 0, "add via parent realm, remove via child realm");
		w.addEventListener("rv6y", fn);
		EventTarget.prototype.removeEventListener.call(w, "rv6y", fn);
		w.dispatchEvent(new w.Event("rv6y"));
		assertEqual(n, 0, "add via child realm, remove via parent realm");
	`
	),
	t(
		"once-then-remove-readd",
		`
		let n = 0; const fn = () => n++;
		const el = document.createElement("div");
		el.addEventListener("click", fn, { once: true });
		el.click(); el.click();
		el.addEventListener("click", fn);
		el.click();
		el.removeEventListener("click", fn);
		el.click();
		assertEqual(n, 2);
	`
	),
	t(
		"event-in-other-frame-message",
		`
		const f = document.createElement("iframe"); document.body.appendChild(f);
		const w = f.contentWindow;
		const p = new Promise((res) => w.addEventListener("message", (e) => res([e.data, e.origin, e.source === window])));
		w.postMessage({ q: 1 }, "*");
		const r = await p;
		assertEqual(JSON.stringify(r[0]), '{"q":1}');
		assertEqual(r[1], location.origin);
		assert(r[2], "source is parent");
	`
	),
] as Test[];

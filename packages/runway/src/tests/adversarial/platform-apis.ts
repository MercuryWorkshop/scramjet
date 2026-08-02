import { basicTest, htmlTest } from "../../testcommon.ts";

// Assorted platform APIs that pages lean on constantly: blobs and object URLs,
// resource timing, error stacks, storage-adjacent APIs, timers and the
// navigator surface. Anywhere the proxy's own plumbing becomes visible here it
// ends up in analytics payloads and error reports.

export default [
	basicTest({
		name: "platform-blob-basics",
		js: `
			const b = new Blob(["hello"], { type: "text/plain" });
			assertEqual(b.size, 5, "size");
			assertEqual(b.type, "text/plain", "type");
			assertEqual(await b.text(), "hello", "text()");
			assertEqual(new Uint8Array(await b.arrayBuffer()).length, 5, "arrayBuffer()");
			assertEqual(await b.slice(0, 2).text(), "he", "slice");
			const f = new File(["x"], "n.txt", { type: "text/plain" });
			assertEqual(f.name, "n.txt", "File.name");
			assert(f instanceof Blob, "File is a Blob");
		`,
	}),
	basicTest({
		name: "platform-objecturl-fetch",
		js: `
			const u = URL.createObjectURL(new Blob(["objecturl-body"], { type: "text/plain" }));
			assert(u.startsWith("blob:"), "createObjectURL returns a blob: URL, got " + u);
			const r = await fetch(u);
			assertEqual(await r.text(), "objecturl-body", "fetching a blob URL");
			assertEqual(r.status, 200, "status");
			URL.revokeObjectURL(u);
		`,
	}),
	basicTest({
		name: "platform-objecturl-image",
		js: `
			const bytes = Uint8Array.from(
				atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
				(c) => c.charCodeAt(0)
			);
			const u = URL.createObjectURL(new Blob([bytes], { type: "image/gif" }));
			const img = new Image();
			await new Promise((res, rej) => {
				img.onload = res;
				img.onerror = () => rej(new Error("a blob-URL image failed to load"));
				img.src = u;
			});
			assertEqual(img.naturalWidth, 1, "naturalWidth");
			assertEqual(img.src, u, "img.src round trips the blob URL");
			URL.revokeObjectURL(u);
		`,
	}),
	basicTest({
		name: "platform-filereader",
		js: `
			const b = new Blob(["filereader-body"], { type: "text/plain" });
			const text = await new Promise((res, rej) => {
				const fr = new FileReader();
				fr.onload = () => res(fr.result);
				fr.onerror = rej;
				fr.readAsText(b);
			});
			assertEqual(text, "filereader-body", "readAsText");
			const dataUrl = await new Promise((res) => {
				const fr = new FileReader();
				fr.onload = () => res(fr.result);
				fr.readAsDataURL(b);
			});
			assert(dataUrl.startsWith("data:text/plain;base64,"), "readAsDataURL: " + dataUrl);
		`,
	}),
	basicTest({
		name: "platform-canvas",
		js: `
			const bytes = Uint8Array.from(
				atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
				(c) => c.charCodeAt(0)
			);
			const u = URL.createObjectURL(new Blob([bytes], { type: "image/gif" }));
			const img = new Image();
			await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = u; });
			const cv = document.createElement("canvas");
			cv.width = cv.height = 1;
			const ctx = cv.getContext("2d");
			ctx.drawImage(img, 0, 0);
			assert(cv.toDataURL().startsWith("data:image/png;base64,"), "toDataURL is not tainted");
			assertEqual(ctx.getImageData(0, 0, 1, 1).data.length, 4, "getImageData");
			URL.revokeObjectURL(u);
		`,
	}),
	basicTest({
		name: "platform-resource-timing-own-entries",
		js: `
			const names = performance.getEntriesByType("resource").map((e) => e.name);
			assert(names.includes(location.origin + "/script.js"),
				"the page's own script must appear under its real URL, got " + JSON.stringify(names));
			const nav = performance.getEntriesByType("navigation")[0];
			assertEqual(nav.name, location.href, "navigation entry name");
			assertEqual(typeof performance.now(), "number", "performance.now");
		`,
	}),
	basicTest({
		name: "platform-performance-observer",
		js: `
			const seen = await new Promise((resolve) => {
				const po = new PerformanceObserver((list) => {
					resolve(list.getEntries().map((e) => e.name));
					po.disconnect();
				});
				po.observe({ type: "resource", buffered: false });
				fetch("/script.js");
				setTimeout(() => resolve([]), 3000);
			});
			assert(seen.length > 0, "PerformanceObserver saw an entry");
			for (const n of seen) assert(!n.includes("/~/sj/"), "observed entry leaks the proxy URL: " + n);
		`,
	}),
	basicTest({
		name: "platform-timers",
		js: `
			const id = setTimeout(() => {}, 1000);
			assertEqual(typeof id, "number", "setTimeout returns a number");
			clearTimeout(id);
			const args = await new Promise((r) => setTimeout((a, b) => r([a, b]), 0, "x", "y"));
			assertDeepEqual(args, ["x", "y"], "setTimeout extra arguments");
			let ticks = 0;
			await new Promise((r) => {
				const iv = setInterval(() => { if (++ticks >= 3) { clearInterval(iv); r(); } }, 1);
			});
			assertEqual(ticks, 3, "setInterval then clearInterval");
			assertEqual(typeof (await new Promise((r) => requestAnimationFrame(r))), "number", "rAF timestamp");
			const order = [];
			queueMicrotask(() => order.push("micro"));
			await Promise.resolve().then(() => order.push("promise"));
			assertDeepEqual(order, ["micro", "promise"], "microtask ordering");
		`,
	}),
	basicTest({
		name: "platform-secure-context-and-crypto",
		js: `
			assertEqual(
				window.isSecureContext,
				location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1",
				"isSecureContext must agree with the document's own URL"
			);
			assertEqual(typeof crypto.randomUUID, "function", "crypto.randomUUID");
			assertEqual(crypto.randomUUID().length, 36, "randomUUID shape");
			assertEqual(typeof crypto.subtle, "object", "crypto.subtle in a secure context");
			assertEqual(crypto.getRandomValues(new Uint8Array(4)).length, 4, "getRandomValues");
		`,
	}),
	basicTest({
		name: "platform-navigator-surface",
		js: `
			assertEqual(typeof navigator.userAgent, "string", "userAgent");
			assertEqual(typeof navigator.language, "string", "language");
			assert(Array.isArray(navigator.languages), "languages is an array");
			assertEqual(typeof navigator.sendBeacon, "function", "sendBeacon");
			assertEqual(typeof navigator.onLine, "boolean", "onLine");
			assertEqual(typeof navigator.hardwareConcurrency, "number", "hardwareConcurrency");
			assertEqual(navigator.sendBeacon("/beacon", "payload"), true, "sendBeacon accepts a relative URL");
			assertEqual(navigator.sendBeacon(location.origin + "/beacon2"), true, "and an absolute one");
		`,
	}),
	basicTest({
		name: "platform-indexeddb-roundtrip",
		js: `
			const db = await new Promise((res, rej) => {
				const req = indexedDB.open("adversarial-db", 1);
				req.onupgradeneeded = () => req.result.createObjectStore("s");
				req.onsuccess = () => res(req.result);
				req.onerror = () => rej(req.error);
			});
			assertEqual(db.name, "adversarial-db", "database name is not namespaced");
			assertDeepEqual([...db.objectStoreNames], ["s"], "objectStoreNames");
			await new Promise((res, rej) => {
				const tx = db.transaction("s", "readwrite");
				tx.objectStore("s").put("v", "k");
				tx.oncomplete = res;
				tx.onerror = () => rej(tx.error);
			});
			const got = await new Promise((res, rej) => {
				const req = db.transaction("s").objectStore("s").get("k");
				req.onsuccess = () => res(req.result);
				req.onerror = () => rej(req.error);
			});
			assertEqual(got, "v", "put then get");
			db.close();
		`,
	}),
	basicTest({
		name: "platform-form-data",
		js: `
			const f = document.createElement("form");
			f.innerHTML = '<input name="a" value="1"><input name="b" value="2">' +
				'<input type="checkbox" name="c" checked value="on">';
			document.body.appendChild(f);
			assertDeepEqual([...new FormData(f).entries()], [["a", "1"], ["b", "2"], ["c", "on"]], "FormData from a form");
			assertEqual(f.elements.length, 3, "form.elements.length");
			assertEqual(f.elements.a.value, "1", "named access through elements");
			assertEqual(f.a.value, "1", "named access on the form");
			assertEqual(f.elements.namedItem("b").value, "2", "namedItem");
			const fd = new FormData();
			fd.append("k", "v");
			fd.append("f", new Blob(["x"]), "n.txt");
			assertEqual(fd.get("k"), "v", "FormData.get");
			assertEqual(fd.get("f").name, "n.txt", "FormData file entry");
		`,
	}),
	basicTest({
		name: "platform-form-submit-event",
		js: `
			const f = document.createElement("form");
			f.action = "/nowhere";
			f.innerHTML = '<input name="a" value="1"><button type="submit">go</button>';
			document.body.appendChild(f);
			const ev = await new Promise((resolve) => {
				f.addEventListener("submit", (e) => { e.preventDefault(); resolve(e); });
				f.querySelector("button").click();
			});
			assertEqual(ev.target, f, "submit target");
			assertEqual(ev.submitter, f.querySelector("button"), "submitter");
			assertEqual(ev.cancelable, true, "cancelable");
			assertEqual(f.action, location.origin + "/nowhere", "action unchanged");
		`,
	}),
	basicTest({
		name: "platform-intersection-observer",
		js: `
			const d = document.createElement("div");
			d.style.cssText = "width:10px;height:10px";
			document.body.appendChild(d);
			const entry = await new Promise((resolve) => {
				const io = new IntersectionObserver((entries) => { resolve(entries[0]); io.disconnect(); });
				io.observe(d);
				setTimeout(() => resolve(null), 3000);
			});
			assert(entry, "IntersectionObserver fired");
			assertEqual(entry.target, d, "entry target");
			assertEqual(typeof entry.isIntersecting, "boolean", "isIntersecting");
			assertEqual(typeof entry.intersectionRatio, "number", "intersectionRatio");
			assert(entry.rootBounds !== undefined, "rootBounds present");
		`,
	}),
	basicTest({
		name: "platform-resize-observer",
		js: `
			const d = document.createElement("div");
			d.style.cssText = "width:20px;height:10px";
			document.body.appendChild(d);
			const entry = await new Promise((resolve) => {
				const ro = new ResizeObserver((entries) => { resolve(entries[0]); ro.disconnect(); });
				ro.observe(d);
				setTimeout(() => resolve(null), 3000);
			});
			assert(entry, "ResizeObserver fired");
			assertEqual(entry.target, d, "entry target");
			assertEqual(entry.contentRect.width, 20, "contentRect.width");
		`,
	}),
	htmlTest({
		name: "platform-import-meta-url",
		html: `<!DOCTYPE html><html><body><script type="module">
			runTest(async () => {
				assert(!import.meta.url.includes("/~/sj/"),
					"import.meta.url must not expose the proxy URL: " + import.meta.url);
				assertEqual(import.meta.url, location.href, "import.meta.url");
				assertEqual(new URL("./rel.js", import.meta.url).href, location.origin + "/rel.js",
					"resolution against import.meta.url");
			}, true);
		</script></body></html>`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: the proxy's own scripts show up in the page's resource
		// timeline under the harness origin, so RUM and performance-analytics
		// libraries report requests the site never made.
		name: "platform-resource-timing-no-proxy-internals",
		js: `
			const names = performance.getEntriesByType("resource").map((e) => e.name);
			const leaked = names.filter((n) => n.includes("/~/sj/") || n.includes(":4500"));
			assertDeepEqual(leaked, [], "no proxy-internal resources in the page's timeline");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: stack frames carry the whole proxy URL, with the site's
		// real URL percent-encoded inside it. Every error-reporting SDK (Sentry,
		// Bugsnag, Rollbar) ships this verbatim, and stack-parsing code that
		// expects the site's own origin misreads the frame.
		name: "platform-error-stack-urls",
		js: `
			let e;
			try { null.x; } catch (err) { e = err; }
			assert(!e.stack.includes("/~/sj/"), "a caught error's stack must not expose the proxy URL: " + e.stack);
			assert(!e.stack.includes(":4500"), "nor the harness origin: " + e.stack);
		`,
	}),
	basicTest({
		// KNOWN FAILURE: revoking an object URL does not invalidate it, so the
		// blob stays fetchable and its memory stays pinned.
		name: "platform-objecturl-revoke",
		js: `
			const u = URL.createObjectURL(new Blob(["x"]));
			assertEqual(await (await fetch(u)).text(), "x", "fetch before revoke");
			URL.revokeObjectURL(u);
			let failed = false;
			try { await fetch(u); } catch { failed = true; }
			assert(failed, "revokeObjectURL must invalidate the URL");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: databases() reports the namespaced name plus the proxy's
		// own control database.
		name: "platform-indexeddb-databases",
		js: `
			if (!indexedDB.databases) { pass(); return; }
			const db = await new Promise((res, rej) => {
				const req = indexedDB.open("adversarial-db2", 1);
				req.onupgradeneeded = () => req.result.createObjectStore("s");
				req.onsuccess = () => res(req.result);
				req.onerror = () => rej(req.error);
			});
			db.close();
			const names = (await indexedDB.databases()).map((d) => d.name);
			assert(names.includes("adversarial-db2"),
				"databases() must report the page's own name, got " + JSON.stringify(names));
			assert(!names.some((n) => n.includes("scramjet")),
				"and must not expose proxy-internal databases: " + JSON.stringify(names));
		`,
	}),
	basicTest({
		// KNOWN FAILURE: navigator.serviceWorker is absent - most likely
		// deliberate, since the proxy owns the registration, but it is observable:
		// PWAs feature-detect on it and take a different path when it is missing.
		name: "platform-navigator-serviceworker",
		js: `
			assert("serviceWorker" in navigator, "navigator.serviceWorker must exist");
			assertEqual(typeof navigator.serviceWorker, "object", "serviceWorker container");
		`,
	}),
	basicTest({
		name: "platform-datatransfer",
		js: `
			// clipboard and drag payloads must not be rewritten on the way through
			const dt = new DataTransfer();
			dt.setData("text/plain", "plain text");
			dt.setData("text/html", '<a href="/x">y</a>');
			assertEqual(dt.getData("text/plain"), "plain text", "text/plain round trip");
			assertEqual(dt.getData("text/html"), '<a href="/x">y</a>', "text/html is not rewritten");
			assertDeepEqual([...dt.types].sort(), ["text/html", "text/plain"], "types");
			const dt2 = new DataTransfer();
			dt2.items.add(new File(["f"], "f.txt", { type: "text/plain" }));
			assertEqual(dt2.files.length, 1, "items.add produced a FileList");
			assertEqual(dt2.files[0].name, "f.txt", "file name");
		`,
	}),
];

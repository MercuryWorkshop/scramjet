import { basicTest } from "../../testcommon.ts";

// addEventListener is proxied so that handlers can be unwrapped and event
// objects fixed up. The listener registry has to keep the spec's identity
// rules: a (type, callback, capture) triple that is already registered is
// ignored, and removeEventListener has to match on the page's own function.
//
// Registering the same handler twice is the standard idempotent-init pattern;
// if it stops being a no-op, handlers fire twice - double form submits, double
// analytics beacons, double network requests.

export default [
	basicTest({
		name: "events-once-and-signal",
		js: `
			const t = document.createElement("div");
			let once = 0;
			t.addEventListener("y", () => once++, { once: true });
			t.dispatchEvent(new Event("y"));
			t.dispatchEvent(new Event("y"));
			assertEqual(once, 1, "once");
			const ac = new AbortController();
			let aborted = 0;
			t.addEventListener("z", () => aborted++, { signal: ac.signal });
			t.dispatchEvent(new Event("z"));
			ac.abort();
			t.dispatchEvent(new Event("z"));
			assertEqual(aborted, 1, "an aborted signal removes the listener");
		`,
	}),
	basicTest({
		name: "events-remove",
		js: `
			const t = document.createElement("div");
			let n = 0;
			const fn = () => n++;
			t.addEventListener("x", fn);
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "fired once");
			t.removeEventListener("x", fn);
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "removeEventListener with the same function");
			t.addEventListener("c", fn, true);
			t.removeEventListener("c", fn, true);
			t.dispatchEvent(new Event("c"));
			assertEqual(n, 1, "capture-phase removal");
			t.addEventListener("o", fn, { capture: true });
			t.removeEventListener("o", fn, { capture: true });
			t.dispatchEvent(new Event("o"));
			assertEqual(n, 1, "capture removal via options");
		`,
	}),
	basicTest({
		name: "events-capture-and-bubble-are-distinct",
		js: `
			const t = document.createElement("div");
			let n = 0;
			const fn = () => n++;
			t.addEventListener("y", fn, false);
			t.addEventListener("y", fn, true);
			t.dispatchEvent(new Event("y"));
			assertEqual(n, 2, "capture and bubble are separate registrations");
		`,
	}),
	basicTest({
		name: "events-handleevent-object",
		js: `
			const t = document.createElement("div");
			let n = 0;
			const handler = { handleEvent() { n++; } };
			t.addEventListener("x", handler);
			t.addEventListener("x", handler);
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "handleEvent objects are deduped");
			t.removeEventListener("x", handler);
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "and removable");
		`,
	}),
	basicTest({
		name: "events-propagation",
		js: `
			const outer = document.createElement("div");
			const inner = document.createElement("span");
			outer.appendChild(inner);
			document.body.appendChild(outer);
			const order = [];
			outer.addEventListener("t", (e) => {
				order.push("capture:" + (e.currentTarget === outer) + ":" + (e.target === inner));
			}, true);
			inner.addEventListener("t", () => order.push("target"));
			outer.addEventListener("t", () => order.push("bubble"));
			inner.dispatchEvent(new Event("t", { bubbles: true }));
			assertDeepEqual(order, ["capture:true:true", "target", "bubble"], "order, currentTarget and target");
			let detail, path;
			outer.addEventListener("c", (e) => { detail = e.detail; path = e.composedPath(); });
			const ce = new CustomEvent("c", { detail: { a: 1 }, bubbles: true });
			inner.dispatchEvent(ce);
			assertDeepEqual(detail, { a: 1 }, "CustomEvent detail");
			assertEqual(ce.isTrusted, false, "a synthetic event is not trusted");
			assertDeepEqual(
				path.slice(0, 2).map((n) => n === inner || n === outer),
				[true, true],
				"composedPath starts at the target"
			);
		`,
	}),
	basicTest({
		name: "events-stop-and-cancel",
		js: `
			const t = document.createElement("div");
			document.body.appendChild(t);
			const seen = [];
			t.addEventListener("s", (e) => { seen.push(1); e.stopImmediatePropagation(); });
			t.addEventListener("s", () => seen.push(2));
			t.dispatchEvent(new Event("s"));
			assertDeepEqual(seen, [1], "stopImmediatePropagation");
			const ev = new Event("p", { cancelable: true });
			t.addEventListener("p", (e) => e.preventDefault());
			assertEqual(t.dispatchEvent(ev), false, "dispatchEvent returns false when cancelled");
			assertEqual(ev.defaultPrevented, true, "defaultPrevented");
		`,
	}),
	basicTest({
		name: "events-handler-property",
		js: `
			const t = document.createElement("div");
			let n = 0;
			t.onclick = () => n++;
			t.onclick = () => { n += 10; };
			t.dispatchEvent(new Event("click"));
			assertEqual(n, 10, "assigning onclick twice replaces the handler");
			assertEqual(typeof t.onclick, "function", "onclick reads back as a function");
			t.onclick = null;
			t.dispatchEvent(new Event("click"));
			assertEqual(n, 10, "nulling onclick removes it");
		`,
	}),
	basicTest({
		name: "events-unhandledrejection",
		autoPass: false,
		js: `
			const ev = await new Promise((resolve) => {
				window.addEventListener("unhandledrejection", resolve, { once: true });
				Promise.reject(new Error("nope"));
			});
			assertEqual(ev.reason.message, "nope", "reason");
			assertEqual(ev.type, "unhandledrejection", "type");
			ev.preventDefault();
			pass();
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: a second registration of the same function is not
		// recognised as a duplicate, so the handler runs twice.
		name: "events-duplicate-listener-element",
		js: `
			const t = document.createElement("div");
			let n = 0;
			const fn = () => n++;
			t.addEventListener("x", fn);
			t.addEventListener("x", fn);
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "duplicate listeners must be deduped");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same on the global targets, which is where idempotent
		// init code usually registers.
		name: "events-duplicate-listener-global",
		js: `
			let w = 0;
			const wf = () => w++;
			window.addEventListener("adversarial-w", wf);
			window.addEventListener("adversarial-w", wf);
			window.dispatchEvent(new Event("adversarial-w"));
			window.removeEventListener("adversarial-w", wf);
			assertEqual(w, 1, "window duplicate listeners must be deduped");
			let d = 0;
			const df = () => d++;
			document.addEventListener("adversarial-d", df);
			document.addEventListener("adversarial-d", df);
			document.dispatchEvent(new Event("adversarial-d"));
			document.removeEventListener("adversarial-d", df);
			assertEqual(d, 1, "document duplicate listeners must be deduped");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: also with an options bag, which is the common modern form.
		name: "events-duplicate-listener-options",
		js: `
			const t = document.createElement("div");
			let n = 0;
			const fn = () => n++;
			t.addEventListener("x", fn, { passive: true });
			t.addEventListener("x", fn, { passive: true });
			t.dispatchEvent(new Event("x"));
			assertEqual(n, 1, "deduped with identical options");
		`,
	}),
];

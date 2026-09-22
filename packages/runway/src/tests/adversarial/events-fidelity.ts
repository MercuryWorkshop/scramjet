import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// The event interceptor substitutes a stand-in event so it can rewrite members
// a proxy would otherwise leak - `MessageEvent.origin` above all. Substitution
// is the only mechanism available for that: `isTrusted` is [LegacyUnforgeable],
// an own non-configurable accessor on every instance with nothing on the
// prototype chain to intercept, so the stand-in is not an implementation
// detail, it is the whole seam.
//
// These pin the properties that substitution is easy to get wrong: the identity
// of the stand-in, what it does to members nobody rewrote, and which of the
// several message transports it claims an origin for.

const differential = (name: string, js: string) =>
	basicTest({
		name: `events-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name, message: error && error.message };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

const GRAB = `const grab = (fn) => new Promise((r) => { const t = setTimeout(() => r("TIMEOUT"), 2000); fn((v) => { clearTimeout(t); r(v); }); });`;

export default [
	// --- origin is the sender's, per transport ------------------------------

	differential(
		"origin-window-postmessage",
		`(async () => { ${GRAB}
			return (await grab((done) => {
				window.addEventListener("message", function h(e) {
					if (e.data !== "w") return;
					window.removeEventListener("message", h);
					done(e.origin);
				});
				window.postMessage("w", "*");
			})) === location.origin ? "site-origin" : "other";
		})()`
	),

	// a port message has no origin at all - the browser reports ""
	differential(
		"origin-messageport",
		`(async () => { ${GRAB}
			return await grab((done) => {
				const mc = new MessageChannel();
				mc.port2.onmessage = (e) => done({ origin: e.origin, lastEventId: e.lastEventId });
				mc.port2.start();
				mc.port1.postMessage("p");
			});
		})()`
	),

	differential(
		"origin-broadcastchannel",
		`(async () => { ${GRAB}
			const got = await grab((done) => {
				const name = "evfid-" + Math.random();
				const a = new BroadcastChannel(name), b = new BroadcastChannel(name);
				b.onmessage = (e) => { a.close(); b.close(); done(e.origin); };
				a.postMessage("b");
			});
			return got === location.origin ? "site-origin" : got;
		})()`
	),

	// --- an EventListener object is a listener like any other ---------------

	// the same rewriting a function listener gets: the data unwrapped, the
	// sender's origin, and `this` the object rather than the target
	differential(
		"handleevent-object-is-rewritten",
		`(async () => { ${GRAB}
			return await grab((done) => {
				const listener = {
					handleEvent(e) {
						if (e.data !== "obj") return;
						window.removeEventListener("message", listener);
						done({
							data: e.data,
							origin: e.origin === location.origin ? "site-origin" : "other",
							thisIsObject: this === listener,
							eventIsWindowEvent: window.event === e,
						});
					},
				};
				window.addEventListener("message", listener);
				window.postMessage("obj", "*");
			});
		})()`
	),

	// handleEvent is looked up per dispatch, not captured at registration
	differential(
		"handleevent-looked-up-per-dispatch",
		`(async () => { ${GRAB}
			return await grab((done) => {
				const calls = [];
				const listener = { handleEvent() { calls.push("first"); } };
				window.addEventListener("message", listener);
				listener.handleEvent = (e) => {
					if (e.data !== "swap") return;
					calls.push("second");
					window.removeEventListener("message", listener);
					done(calls);
				};
				window.postMessage("swap", "*");
			});
		})()`
	),

	// added twice is registered once, and removing it removes it
	differential(
		"handleevent-dedupe-and-remove",
		`(async () => { ${GRAB}
			return await grab((done) => {
				let count = 0;
				const listener = { handleEvent(e) { if (e.data === "dedupe") count++; } };
				window.addEventListener("message", listener);
				window.addEventListener("message", listener);
				window.addEventListener("message", function h(e) {
					if (e.data === "dedupe") {
						window.removeEventListener("message", listener);
						window.postMessage("after-remove", "*");
					} else if (e.data === "after-remove") {
						window.removeEventListener("message", h);
						done(count);
					}
				});
				window.postMessage("dedupe", "*");
			});
		})()`
	),

	// a non-callable handleEvent is reported, and does not stop dispatch
	differential(
		"handleevent-not-callable-is-reported",
		`(async () => { ${GRAB}
			return await grab((done) => {
				let reported = null;
				const onerror = (e) => { reported = e.error && e.error.constructor.name; e.preventDefault(); };
				window.addEventListener("error", onerror);
				const bad = { handleEvent: 42 };
				window.addEventListener("message", bad);
				window.addEventListener("message", function h(e) {
					if (e.data !== "bad") return;
					window.removeEventListener("message", h);
					window.removeEventListener("message", bad);
					window.removeEventListener("error", onerror);
					done({ reported, laterListenerRan: true });
				});
				window.postMessage("bad", "*");
			});
		})()`
	),

	// --- the stand-in must be one object, and must not invent members -------

	basicTest({
		name: "events-one-object-per-dispatch",
		js: `
			${GRAB}
			const seen = [];
			await grab((done) => {
				window.addEventListener("message", (e) => { seen.push(e); });
				window.addEventListener("message", (e) => { seen.push(e); });
				window.onmessage = (e) => { seen.push(e); setTimeout(() => done(), 50); };
				window.postMessage("ident", "*");
			});
			assertEqual(seen.length, 3, "all three handlers ran");
			assert(seen[0] === seen[1], "two addEventListener listeners share one event object");
			assert(seen[1] === seen[2], "the onmessage handler sees that same object");
		`,
	}),

	differential(
		"untouched-members-are-not-rewritten",
		`(async () => { ${GRAB}
			return await grab((done) => {
				window.addEventListener("message", function h(e) {
					if (e.data !== "m") return;
					window.removeEventListener("message", h);
					done({
						ctor: e.constructor === MessageEvent,
						str: typeof e.toString,
						hasOwn: typeof e.hasOwnProperty,
						valueOf: typeof e.valueOf,
						// the gate must not be reachable as a member
						init: typeof e.init,
						methodIdentity: e.stopPropagation === e.stopPropagation,
						methodWorks: (() => { try { e.stopPropagation(); return "ok"; } catch (err) { return err.constructor.name; } })(),
						toStringTag: Object.prototype.toString.call(e),
					});
				});
				window.postMessage("m", "*");
			});
		})()`
	),

	// members nobody rewrote have to come off the real event, not off whatever
	// object the trap happened to close over
	differential(
		"untouched-members-come-from-the-event",
		`(async () => { ${GRAB}
			const mc = new MessageChannel();
			return await grab((done) => {
				window.addEventListener("message", function h(e) {
					if (e.data !== "withport") return;
					window.removeEventListener("message", h);
					done({
						ports: e.ports.length,
						portsSameObject: e.ports === e.ports,
						portsFrozen: Object.isFrozen(e.ports),
						portUsable: (() => { try { e.ports[0].start(); e.ports[0].close(); return "ok"; } catch (err) { return err.constructor.name; } })(),
						type: e.type,
						target: e.target === window,
						bubbles: e.bubbles,
						lastEventId: e.lastEventId,
					});
				});
				window.postMessage("withport", "*", [mc.port2]);
			});
		})()`
	),

	// --- on* handlers are per instance, not per interface -------------------

	basicTest({
		name: "events-onmessage-is-per-instance",
		js: `
			const a = new MessageChannel(), b = new MessageChannel(), c = new MessageChannel();
			const fa = function fa(){}, fb = function fb(){};
			a.port1.onmessage = fa;
			b.port1.onmessage = fb;
			assert(a.port1.onmessage === fa, "port A keeps its own handler after B is assigned");
			assert(b.port1.onmessage === fb, "port B keeps its own");
			assertEqual(c.port1.onmessage, null, "an untouched port has no handler");

			const c1 = new BroadcastChannel("perinst1-" + Math.random());
			const c2 = new BroadcastChannel("perinst2-" + Math.random());
			c1.onmessage = fa; c2.onmessage = fb;
			assert(c1.onmessage === fa, "BroadcastChannel is per instance too");
			c1.close(); c2.close();

			const w = window;
			w.onmessage = fa; w.onhashchange = fb;
			assert(w.onmessage === fa, "window.onmessage survives onhashchange being set");
			assert(w.onhashchange === fb, "window.onhashchange is its own slot");
			w.onmessage = null; w.onhashchange = null;
		`,
	}),

	basicTest({
		name: "events-no-registry-symbol-leak",
		js: `
			window.onmessage = function keep(){};
			const sym = Symbol.for("scramjet original onevent function");
			assert(!Object.getOwnPropertySymbols(window).some((s) => s === sym),
				"the bookkeeping symbol is not an own property of window");
			assertEqual(window[sym], undefined, "and is not readable through the registry symbol");
			window.onmessage = null;
		`,
	}),

	// --- document.body's handlers ARE the window's --------------------------

	// one slot, two names: whichever is written, both read the same value
	differential(
		"body-and-window-share-handlers",
		`(async () => {
			const f = function f() {}, g = function g() {};
			const out = {};
			window.onmessage = f;
			out.bodySeesWindow = document.body.onmessage === f;
			document.body.onmessage = null;
			out.windowClearedByBody = window.onmessage;
			document.body.onhashchange = g;
			out.windowSeesBody = window.onhashchange === g;
			document.body.setAttribute("onstorage", "void 0");
			out.attributeReplaces = typeof window.onstorage === "function" && window.onstorage !== f && window.onstorage !== g;
			window.onmessage = 5;
			out.primitiveIsNull = window.onmessage;
			window.onhashchange = null;
			document.body.removeAttribute("onstorage");
			return out;
		})()`
	),

	basicTest({
		name: "events-body-onmessage-is-covered",
		js: `
			${GRAB}
			const got = await grab((done) => {
				document.body.onmessage = (e) => { done({ origin: e.origin, data: e.data }); };
				window.postMessage("viabody", "*");
			});
			document.body.onmessage = null;
			assertEqual(got.data, "viabody", "a handler on document.body receives window messages");
			assertEqual(got.origin, location.origin, "and is rewritten like any other path");
		`,
	}),
];

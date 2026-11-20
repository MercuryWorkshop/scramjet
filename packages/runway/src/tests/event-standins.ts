import { WebSocketServer } from "ws";
import { basicTest, htmlTest, serverTest, type Test } from "../testcommon.ts";

/**
 * The events a listener is handed a stand-in for - the ones scramjet rewrites
 * (`message`, `hashchange`, `storage`) and the ones it dispatches itself (a
 * fake WebSocket's) - behave like the real event wherever the page takes
 * them: as the receiver of a prototype member, through an assignment, and
 * dispatched again. Compared against bare Chrome.
 */

/**
 * `PROBE(e, keys)`: everything the page can do with an event, as values to
 * compare. `keys` are the event's own interface's attributes.
 */
const PROBE = `
const S = (f) => { try { return f(); } catch (err) { return "throws " + err.name; } };
const view = (v) => v === window ? "window" : v && typeof v === "object" ? Object.prototype.toString.call(v) : typeof v === "string" ? v.replace(location.origin, "O") : v;
window.PROBE = (e, keys) => {
	const out = {};
	const proto = Object.getPrototypeOf(e);
	for (const key of keys) {
		out["get " + key] = S(() => {
			const v = Object.getOwnPropertyDescriptor(proto, key).get.call(e);
			return [view(v), v === e[key]];
		});
	}
	// read the usual way, through the stand-in
	out.inherited = ["type", "target", "currentTarget", "eventPhase", "bubbles", "cancelable", "defaultPrevented", "composed"].map((k) => view(e[k]));
	out.methodIdentity = [e.preventDefault === Event.prototype.preventDefault, e.composedPath === Event.prototype.composedPath];
	out.methodCall = S(() => { Event.prototype.preventDefault.call(e); return Event.prototype.composedPath.call(e).length; });
	out.boundCall = S(() => { const f = e.stopImmediatePropagation; return typeof f; });
	out.setters = S(() => { e.returnValue = true; e.cancelBubble = false; return [e.returnValue, e.cancelBubble]; });
	out.windowEvent = window.event === e;
	out.instance = [e instanceof Event, e instanceof proto.constructor, Object.prototype.toString.call(e), e.constructor === proto.constructor];
	out.isTrusted = e.isTrusted;
	out.copy = S(() => { const c = new proto.constructor(e.type, e); return keys.map((k) => view(c[k]) === view(e[k])); });
	return out;
};
// the event and its probe, taken inside the listener: after it, a dispatch
// scramjet runs from script has already finished, and one the browser runs
// has not
window.CATCH = (target, type, keys, start) => new Promise((resolve) => {
	target.addEventListener(type, (ev) => resolve([ev, PROBE(ev, keys)]), { once: true });
	start();
});
// dispatched again, after the browser is done with it
window.REDISPATCH = (e, keys) => new Promise((resolve) => setTimeout(() => {
	const t = new EventTarget();
	let got = "not delivered";
	t.addEventListener(e.type, (ev) => { got = [ev === e, keys.map((k) => view(ev[k]) === view(e[k])), window.event === ev, ev.isTrusted]; });
	const r = S(() => t.dispatchEvent(e));
	resolve([r, got]);
}, 0));
`;

const probeTest = (name: string, js: string) =>
	basicTest({
		name,
		js: `${PROBE}\n${js}`,
	});

export default [
	probeTest(
		"standin-message-window",
		`
		const keys = ["data", "origin", "lastEventId", "source", "ports"];
		const [e, probe] = await CATCH(window, "message", keys, () => postMessage({ x: 1 }, "*"));
		assertConsistent("probe", probe);
		assertConsistent("data", e.data);
		assertConsistent("redispatch", await REDISPATCH(e, keys));
	`
	),

	probeTest(
		"standin-message-port",
		`
		const keys = ["data", "origin", "lastEventId", "source", "ports"];
		const { port1, port2 } = new MessageChannel();
		const [e, probe] = await CATCH(port2, "message", keys, () => { port2.start(); port1.postMessage("hi"); });
		assertConsistent("probe", probe);
		assertConsistent("redispatch", await REDISPATCH(e, keys));
	`
	),

	probeTest(
		"standin-hashchange",
		`
		const keys = ["oldURL", "newURL"];
		history.replaceState(null, "", location.pathname);
		const [e, probe] = await CATCH(window, "hashchange", keys, () => (location.hash = "standin"));
		assertConsistent("probe", probe);
		assertConsistent("redispatch", await REDISPATCH(e, keys));
	`
	),

	probeTest(
		"standin-storage",
		`
		const keys = ["key", "oldValue", "newValue", "url", "storageArea"];
		localStorage.clear();
		const f = document.createElement("iframe");
		document.body.append(f);
		const [e, probe] = await CATCH(window, "storage", keys, () => f.contentWindow.localStorage.setItem("standin", "v"));
		assertConsistent("probe", probe);
		assertConsistent("redispatch", await REDISPATCH(e, keys));
		localStorage.clear();
	`
	),

	// fails for another reason: the page's `localStorage` is scramjet's wrapper
	// around the real area, and the two are never mapped onto each other - an
	// event's `storageArea` is the real one, and the StorageEvent constructor
	// rejects the wrapper as not a Storage
	probeTest(
		"standin-storage-area-identity",
		`
		localStorage.clear();
		const f = document.createElement("iframe");
		document.body.append(f);
		const e = await new Promise((r) => { addEventListener("storage", r, { once: true }); f.contentWindow.localStorage.setItem("standin", "v"); });
		assertConsistent("event", e.storageArea === localStorage);
		assertConsistent("constructed", S(() => new StorageEvent("storage", { storageArea: localStorage }).storageArea === localStorage));
		localStorage.clear();
	`
	),

	// fails by design: `Event.prototype`'s own getters are left native, and
	// throw on a stand-in. Every event on the page reads through them, and a
	// layer that let them take a stand-in cost each read ~100ns - to serve a
	// getter taken off the prototype and called on an event, which nothing but
	// a test does (see `acceptStandIns` in core's `client/shared/event.ts`)
	probeTest(
		"standin-event-getter-on-prototype",
		`
		const [e] = await CATCH(window, "message", [], () => postMessage(1, "*"));
		assertConsistent("type", S(() => Object.getOwnPropertyDescriptor(Event.prototype, "type").get.call(e)));
	`
	),

	basicTest({
		name: "standin-handler-global-takes-only-events",
		scramjetOnly: true,
		js: `
			// the global an event handler content attribute's body calls is on
			// the page's window, and the page can call it. Something that only
			// looks like a browser event must come back untouched, never with the
			// views that resolve a client id to another client's window
			const standin = window["$scramjet$" + "standin"];
			assert(typeof standin === "function", "the global is there");
			const fake = {
				isTrusted: true,
				type: "message",
				data: { $scramjet$messagetype: "window", $scramjet$clientid: 1, $scramjet$origin: "https://a.example", $scramjet$data: 1 },
			};
			assert(standin(fake) === fake, "a look-alike is not given a stand-in");
			assert(fake.source === undefined, "and gets no source");
			assert(standin("a message") === "a message", "onerror's string passes through");
			const made = new MessageEvent("message", { data: 1 });
			assert(standin(made) === made, "a page-made event needs no stand-in");
		`,
	}),

	// an event handler content attribute is compiled and called by the browser
	// itself, with no listener wrapper in the way
	htmlTest({
		name: "standin-content-attribute-parsed",
		html: `<!doctype html><html><head></head>
			<body onmessage="window.got = [event.data, event.origin.replace(location.origin, 'O'), event.source === window, window.event === event, arguments[0] === event]">
			<script>runTest(async () => {
				postMessage({ x: 1 }, "*");
				await new Promise((r) => setTimeout(r, 200));
				assertConsistent("handler", window.got ?? null);
			}, true);</script>
			</body></html>`,
	}),

	probeTest(
		"standin-content-attribute-set",
		`
		// with a directive, which has to stay the first thing in the body
		document.body.setAttribute("onhashchange", "'use strict'; window.got = [event.newURL.replace(location.origin, 'O'), (function () { return this === undefined; })(), window.event === event]");
		document.body.setAttribute("onmessage", "window.msg = [event.data, event.origin.replace(location.origin, 'O')]");
		history.replaceState(null, "", location.pathname);
		location.hash = "attr";
		postMessage("m", "*");
		await new Promise((r) => setTimeout(r, 200));
		assertConsistent("hashchange", window.got ?? null);
		assertConsistent("message", window.msg ?? null);
		assertConsistent("attribute", document.body.getAttribute("onhashchange"));
	`
	),

	probeTest(
		"standin-not-for-page-events",
		`
		// an event the page made itself never gets a stand-in, and reads back
		// exactly what it was given
		const keys = ["data", "origin", "lastEventId", "source", "ports"];
		const made = new MessageEvent("message", { data: { $scramjet$data: 1 }, origin: "https://made.example" });
		let got;
		addEventListener("message", (ev) => (got = ev), { once: true });
		dispatchEvent(made);
		assertConsistent("same object", got === made);
		assertConsistent("probe", PROBE(made, keys));
		assertConsistent("data", made.data);
	`
	),

	serverTest({
		name: "standin-websocket",
		autoPass: true,
		js: `
			${PROBE}
			const socket = new WebSocket("ws://localhost:" + location.port);
			const [, open] = await CATCH(socket, "open", [], () => {});
			assertConsistent("open", open);
			const messageKeys = ["data", "origin", "lastEventId", "source", "ports"];
			const [message, messageProbe] = await CATCH(socket, "message", messageKeys, () => socket.send("echo"));
			assertConsistent("message", messageProbe);
			assertConsistent("message redispatch", await REDISPATCH(message, messageKeys));
			const closeKeys = ["code", "reason", "wasClean"];
			const [close, closeProbe] = await CATCH(socket, "close", closeKeys, () => socket.close(4000, "done"));
			assertConsistent("close", closeProbe);
			assertConsistent("close redispatch", await REDISPATCH(close, closeKeys));
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket) => {
				socket.on("message", (message, isBinary) =>
					socket.send(message, { binary: isBinary })
				);
			});
		},
	}),
	// a dispatch that throws, because the event is still being dispatched,
	// leaves it as trusted as it was
	serverTest({
		name: "standin-websocket-redispatch-in-flight",
		autoPass: true,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			await new Promise((r) => socket.addEventListener("open", r));
			const seen = [];
			const done = new Promise((resolve) => {
				socket.addEventListener("message", (e) => {
					try {
						new EventTarget().dispatchEvent(e);
						seen.push("dispatched");
					} catch (err) {
						seen.push(err.name);
					}
				});
				socket.addEventListener("message", (e) => {
					seen.push(e.isTrusted);
					resolve();
				});
			});
			socket.send("echo");
			await done;
			assertConsistent("seen", seen);
			socket.close();
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket) => {
				socket.on("message", (message, isBinary) =>
					socket.send(message, { binary: isBinary })
				);
			});
		},
	}),
] as Test[];

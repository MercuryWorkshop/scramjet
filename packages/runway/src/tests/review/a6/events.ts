import { basicTest, htmlTest, type Test } from "../../../testcommon.ts";

const t = (
	name: string,
	js: string,
	extra: Partial<Parameters<typeof basicTest>[0]> = {}
) =>
	basicTest({
		name: "rv6-ev-" + name,
		js,
		...extra,
	});

export default [
	t(
		"bare-add-strict",
		`
		"use strict";
		let n = 0;
		const f = () => n++;
		addEventListener("rv6", f);
		dispatchEvent(new Event("rv6"));
		removeEventListener("rv6", f);
		dispatchEvent(new Event("rv6"));
		assertEqual(n, 1);
	`
	),
	t(
		"bare-add-call-undefined",
		`
		let n = 0;
		const f = () => n++;
		const add = window.addEventListener;
		add.call(undefined, "rv6", f);
		dispatchEvent(new Event("rv6"));
		const rem = window.removeEventListener;
		rem.call(undefined, "rv6", f);
		dispatchEvent(new Event("rv6"));
		assertEqual(n, 1);
	`
	),
	t(
		"destructured-add",
		`
		let n = 0;
		const f = () => n++;
		const { addEventListener: a, removeEventListener: r, dispatchEvent: d } = window;
		a("rv6", f);
		d(new Event("rv6"));
		r("rv6", f);
		d(new Event("rv6"));
		assertEqual(n, 1);
	`
	),
	t(
		"message-handleEvent-object",
		`
		await new Promise((res, rej) => {
			const obj = { handleEvent(e) { try { assertEqual(e.data, "hi"); assertEqual(e.origin, location.origin); assertEqual(this, obj); res(); } catch (x) { rej(x); } } };
			addEventListener("message", obj);
			postMessage("hi", "*");
		});
	`
	),
	t(
		"message-once",
		`
		let n = 0;
		addEventListener("message", () => n++, { once: true });
		postMessage("a", "*"); postMessage("b", "*");
		await new Promise(r => setTimeout(r, 100));
		assertEqual(n, 1);
	`
	),
	t(
		"message-signal",
		`
		let n = 0;
		const ac = new AbortController();
		addEventListener("message", () => n++, { signal: ac.signal });
		postMessage("a", "*");
		await new Promise(r => setTimeout(r, 50));
		ac.abort();
		postMessage("b", "*");
		await new Promise(r => setTimeout(r, 50));
		assertEqual(n, 1);
	`
	),
	t(
		"remove-capture-mismatch",
		`
		let n = 0;
		const f = () => n++;
		addEventListener("message", f, true);
		removeEventListener("message", f);
		postMessage("a", "*");
		await new Promise(r => setTimeout(r, 50));
		assertEqual(n, 1, "capture listener must survive a non-capture remove");
		removeEventListener("message", f, { capture: true });
		postMessage("a", "*");
		await new Promise(r => setTimeout(r, 50));
		assertEqual(n, 1);
	`
	),
	t(
		"remove-message",
		`
		let n = 0;
		const f = () => n++;
		addEventListener("message", f);
		removeEventListener("message", f);
		postMessage("a", "*");
		await new Promise(r => setTimeout(r, 50));
		assertEqual(n, 0);
	`
	),
	t(
		"add-twice",
		`
		let n = 0;
		const f = () => n++;
		document.body.addEventListener("click", f);
		document.body.addEventListener("click", f);
		document.body.click();
		assertEqual(n, 1);
	`
	),
	t(
		"event-props",
		`
		await new Promise((res, rej) => {
			addEventListener("message", function (e) {
				try {
					assert(e instanceof MessageEvent, "instanceof");
					assertEqual(e.constructor, MessageEvent, "ctor");
					assertEqual(e.target, window, "target");
					assertEqual(e.currentTarget, window, "currentTarget");
					assertEqual(this, window, "this");
					assertEqual(e.composedPath()[0], window, "composedPath");
					assertEqual(e.type, "message");
					assertEqual(e.source, window, "source");
					assertEqual(e.ports.length, 0, "ports");
					assertEqual(Object.prototype.toString.call(e), "[object MessageEvent]");
					assertEqual(e.data.x, 1);
					assertEqual(e.data, e.data, "data identity");
					assertEqual(window.event, e, "window.event");
					e.stopPropagation(); e.preventDefault(); e.stopImmediatePropagation();
					assertEqual(typeof e.timeStamp, "number");
					assertEqual(JSON.stringify(Object.keys(e.data)), '["x"]');
					res();
				} catch (x) { rej(x); }
			});
			postMessage({ x: 1 }, "*");
		});
	`
	),
	t(
		"window-event-outside",
		`
		assertEqual(window.event, undefined, "outside dispatch");
		let seen;
		document.body.addEventListener("click", (e) => { seen = window.event === e; });
		document.body.click();
		assert(seen, "click window.event");
		assertEqual(window.event, undefined);
	`
	),
	t(
		"onmessage-prop",
		`
		const f = (e) => { window.__got = e.data; };
		window.onmessage = f;
		assertEqual(window.onmessage, f, "getter returns original");
		postMessage("pp", "*");
		await new Promise(r => setTimeout(r, 50));
		assertEqual(window.__got, "pp");
		window.onmessage = null;
		assertEqual(window.onmessage, null);
		document.body.onmessage = f;
		assertEqual(window.onmessage, f, "body.onmessage aliases window");
		window.onmessage = null;
	`
	),
	t(
		"onclick-attr-this",
		`
		const b = document.createElement("button");
		b.setAttribute("onclick", "window.__this = this; window.__ev = event.type; return false;");
		document.body.appendChild(b);
		b.click();
		assertEqual(window.__this, b);
		assertEqual(window.__ev, "click");
		assertEqual(typeof b.onclick, "function");
	`
	),
	t(
		"hashchange",
		`
		await new Promise((res, rej) => {
			addEventListener("hashchange", (e) => {
				try { assertEqual(e.newURL, location.href); assert(!e.oldURL.includes("/~/"), e.oldURL); res(); } catch (x) { rej(x); }
			}, { once: true });
			location.hash = "#rv6";
		});
	`
	),
	t(
		"error-event",
		`
		await new Promise((res, rej) => {
			addEventListener("error", (e) => {
				e.preventDefault();
				try { assertEqual(e.message.includes("rv6boom"), true, e.message); assert(!String(e.filename).includes("/~/"), "filename " + e.filename); assertEqual(e.error.message, "rv6boom"); res(); } catch (x) { rej(x); }
			}, { once: true });
			setTimeout(() => { throw new Error("rv6boom"); });
		});
	`
	),
	t(
		"unhandledrejection",
		`
		await new Promise((res, rej) => {
			addEventListener("unhandledrejection", (e) => {
				e.preventDefault();
				try { assertEqual(e.reason.message, "rv6rej"); res(); } catch (x) { rej(x); }
			}, { once: true });
			Promise.reject(new Error("rv6rej"));
		});
	`
	),
	t(
		"bad-listener-types",
		`
		addEventListener("x", null);
		addEventListener("x", undefined);
		let threw = false;
		try { addEventListener("x", 5); } catch (e) { threw = e instanceof TypeError; }
		assert(threw, "primitive listener throws TypeError");
		addEventListener("x", () => {}, 1);
		addEventListener("x", () => {}, "yes");
		removeEventListener("x", () => {}, 1);
		let threw2 = false;
		try { EventTarget.prototype.addEventListener.call({}, "x", () => {}); } catch (e) { threw2 = e instanceof TypeError; }
		assert(threw2, "bad receiver throws");
		addEventListener("x", {});
	`
	),
	t(
		"options-getter-order",
		`
		const log = [];
		const opts = new Proxy({}, { get(t, k) { log.push(String(k)); return undefined; }, has(t,k){ log.push("has:"+String(k)); return false; } });
		addEventListener("x", () => {}, opts);
		assertConsistent("add-opts-log", log.join(","));
	`
	),
	t(
		"custom-event-detail",
		`
		let d;
		addEventListener("rv6c", (e) => { d = e.detail; });
		dispatchEvent(new CustomEvent("rv6c", { detail: { a: 1 } }));
		assertEqual(d.a, 1);
	`
	),
	t(
		"synthetic-message",
		`
		let got;
		addEventListener("rv6m", (e) => { got = [e.data, e.origin, e.isTrusted]; });
		dispatchEvent(new MessageEvent("rv6m", { data: "d", origin: "https://x.y" }));
		assertEqual(got.join(","), "d,https://x.y,false");
		let got2;
		const h = (e) => { got2 = [e.data, e.origin]; };
		addEventListener("message", h);
		dispatchEvent(new MessageEvent("message", { data: "d2", origin: "https://x.y" }));
		removeEventListener("message", h);
		assertEqual(got2.join(","), "d2,https://x.y");
	`
	),
	t(
		"messagechannel",
		`
		const mc = new MessageChannel();
		const p = new Promise((res, rej) => { mc.port2.onmessage = (e) => { try { assertEqual(e.data.v, 7); assertEqual(e.origin, ""); assertEqual(e.source, null); res(); } catch (x) { rej(x); } }; });
		mc.port1.postMessage({ v: 7 });
		await p;
		const p2 = new Promise((res) => { mc.port1.addEventListener("message", (e) => res(e.data)); mc.port1.start(); });
		mc.port2.postMessage("back");
		assertEqual(await p2, "back");
	`
	),
	t(
		"transfer-port-window",
		`
		const mc = new MessageChannel();
		const p = new Promise((res, rej) => {
			addEventListener("message", (e) => {
				try {
					assertEqual(e.data, "withport");
					assertEqual(e.ports.length, 1);
					e.ports[0].onmessage = (m) => res(m.data);
					mc.port2.postMessage("viaport");
				} catch (x) { rej(x); }
			}, { once: true });
		});
		postMessage("withport", "*", [mc.port1]);
		assertEqual(await p, "viaport");
		const mc2 = new MessageChannel();
		const p2 = new Promise((res) => addEventListener("message", (e) => res(e.ports.length), { once: true }));
		postMessage("opts", { targetOrigin: "*", transfer: [mc2.port1] });
		assertEqual(await p2, 1);
	`
	),
	t(
		"transfer-arraybuffer",
		`
		const ab = new ArrayBuffer(8);
		const p = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		postMessage(ab, "*", [ab]);
		assertEqual(ab.byteLength, 0, "detached");
		assertEqual((await p).byteLength, 8);
	`
	),
	t(
		"dataclone-error",
		`
		let name;
		try { postMessage(() => {}, "*"); } catch (e) { name = e.name; }
		assertEqual(name, "DataCloneError");
		let name2;
		try { postMessage("x", "not a url"); } catch (e) { name2 = e.name; }
		assertEqual(name2, "SyntaxError");
	`
	),
	t(
		"broadcastchannel",
		`
		const a = new BroadcastChannel("rv6"), b = new BroadcastChannel("rv6");
		const p = new Promise((res, rej) => { b.onmessage = (e) => { try { assertEqual(e.data.q, 2); assertEqual(e.origin, location.origin); res(); } catch (x) { rej(x); } }; });
		a.postMessage({ q: 2 });
		await p; a.close(); b.close();
	`
	),
	t(
		"worker-message",
		`
		const src = "onmessage = (e) => postMessage({ echo: e.data, origin: e.origin, src: e.source === null });";
		const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		const r = await new Promise((res) => { w.onmessage = (e) => res([e.data, e.origin]); w.postMessage("w1"); });
		assertEqual(r[0].echo, "w1");
		assertConsistent("worker-origin-in-worker", r[0].origin);
		assertConsistent("worker-origin-in-window", r[1]);
		w.terminate();
	`
	),
	t(
		"self-postmessage-origin-string",
		`
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		postMessage("s", location.origin);
		const e = await p;
		assertEqual(e.data, "s"); assertEqual(e.origin, location.origin); assertEqual(e.source, window);
		const p2 = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		postMessage("s2");
		assertEqual(await p2, "s2");
		const p3 = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		postMessage("s3", "/");
		assertEqual(await p3, "s3");
	`
	),
	t(
		"wrong-origin-dropped",
		`
		let got = [];
		const h = (e) => got.push(e.data);
		addEventListener("message", h);
		postMessage("bad", "https://example.org");
		postMessage("good", "*");
		await new Promise(r => setTimeout(r, 100));
		removeEventListener("message", h);
		assertEqual(got.join(","), "good");
	`
	),
] as Test[];

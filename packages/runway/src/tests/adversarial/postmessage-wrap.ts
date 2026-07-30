import { basicTest } from "../../testcommon.ts";

// The rewriter rewrites *every* `.postMessage` member expression to
// `$scramjet$wrappostmessage(obj).postMessage`, and that helper returns a
// throwaway object:
//
//   if (!obj || typeof obj.postMessage !== "function") return obj;
//   return { postMessage: obj.postMessage.bind(obj) };
//
// So the property no longer belongs to the original object. Everything a page
// can do with `.postMessage` other than calling it straight away is affected -
// and Worker/MessagePort/BroadcastChannel plumbing is load-bearing on real
// sites.

export default [
	basicTest({
		name: "pmwrap-call-plain-object",
		js: `
			const o = { postMessage(x) { return this === o ? x * 2 : "wrong this"; } };
			assertEqual(o.postMessage(21), 42, "calling through the wrapper keeps the receiver");
			assertEqual(o["postMessage"](21), 42, "computed access");
			const nested = { inner: o };
			assertEqual(nested.inner.postMessage(21), 42, "nested object");
		`,
	}),
	basicTest({
		name: "pmwrap-non-function-property",
		js: `
			const o = { postMessage: 5 };
			assertEqual(o.postMessage, 5, "a non-callable postMessage is left alone");
			const empty = {};
			assertEqual(empty.postMessage, undefined, "missing postMessage");
			assertEqual(null?.postMessage, undefined, "optional chain on null");
		`,
	}),
	basicTest({
		name: "pmwrap-messagechannel",
		js: `
			const mc = new MessageChannel();
			const received = new Promise((r) => { mc.port2.onmessage = (e) => r(e.data); });
			mc.port1.postMessage({ hello: "world" });
			assertDeepEqual(await received, { hello: "world" }, "MessageChannel round trip");
		`,
	}),
	basicTest({
		name: "pmwrap-worker-transfer",
		autoPass: false,
		js: `
			const src = "self.onmessage = (e) => { postMessage({ len: e.data.buf.byteLength, tag: e.data.tag }); };";
			const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
			const buf = new ArrayBuffer(8);
			const done = new Promise((res, rej) => {
				w.onmessage = (e) => res(e.data);
				w.onerror = (e) => rej(new Error("worker error: " + e.message));
				setTimeout(() => rej(new Error("timeout")), 8000);
			});
			w.postMessage({ buf, tag: "t" }, [buf]);
			const got = await done;
			assertEqual(got.len, 8, "the transferred buffer arrived");
			assertEqual(got.tag, "t", "payload intact");
			assertEqual(buf.byteLength, 0, "the buffer was detached by the transfer");
			pass();
		`,
	}),

	// ------------------------------------------------------------------
	// where the wrapper becomes observable
	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: a fresh wrapper object with a fresh bound function is
		// built on every property read.
		name: "pmwrap-identity",
		js: `
			const o = { postMessage() {} };
			assertEqual(o.postMessage, o.postMessage, "postMessage identity must be stable");
			const mc = new MessageChannel();
			assertEqual(mc.port1.postMessage, mc.port1.postMessage, "MessagePort.postMessage identity");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the wrapper hands back a bound function, so name and
		// length are the bound function's.
		name: "pmwrap-function-shape",
		js: `
			const o = { postMessage(a, b) {} };
			assertEqual(o.postMessage.name, "postMessage", "name");
			assertEqual(o.postMessage.length, 2, "length");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: wrappostmessage reads obj.postMessage twice - once for
		// the typeof guard and once for the bind - so a page-level accessor or a
		// Proxy get trap fires twice.
		name: "pmwrap-getter-invocation-count",
		js: `
			let gets = 0;
			const o = { get postMessage() { gets++; return () => 1; } };
			o.postMessage();
			assertEqual(gets, 1, "the postMessage getter must be read once");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the assignment target is the throwaway wrapper, so
		// monkeypatching postMessage silently does nothing.
		name: "pmwrap-assignment",
		js: `
			const o = { postMessage() { return "orig"; } };
			o.postMessage = function () { return "patched"; };
			assertEqual(o.postMessage(), "patched", "assigning over postMessage must stick");
			const o2 = { postMessage() { return "a"; } };
			const saved = o2.postMessage;
			o2.postMessage = (...args) => "wrapped:" + saved(...args);
			assertEqual(o2.postMessage(), "wrapped:a", "wrapping the original must stick");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: deletes a property of the throwaway wrapper.
		name: "pmwrap-delete",
		js: `
			const o = { postMessage() {} };
			assertEqual(delete o.postMessage, true, "delete reports success");
			assertEqual("postMessage" in o, false, "delete must remove postMessage");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the wrapper binds to whatever the member expression's
		// object was - here the prototype - so the later .call receiver is
		// ignored and the call fails with an illegal invocation. Libraries reach
		// for prototype methods precisely to avoid monkeypatched instances.
		name: "pmwrap-prototype-method",
		js: `
			const mc = new MessageChannel();
			const received = new Promise((r) => { mc.port2.onmessage = (e) => r(e.data); });
			mc.port1.start();
			MessagePort.prototype.postMessage.call(mc.port1, "viaproto");
			assertEqual(await received, "viaproto", "MessagePort.prototype.postMessage.call(port, …)");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: detaching a method loses its receiver in real JS. The
		// wrapper pre-binds it, so scramjet keeps working where the web throws -
		// code that relies on the TypeError (feature detection, `this` guards)
		// takes a different branch.
		name: "pmwrap-detached-loses-receiver",
		js: `
			const o = { tag: "T", postMessage(x) { return this.tag + x; } };
			const detached = o.postMessage;
			let threw = false;
			try { detached("1"); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "a detached postMessage must lose its receiver");
		`,
	}),
];

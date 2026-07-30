import { basicTest } from "../../testcommon.ts";

// Newer platform APIs that sites reach for directly or feature-detect on:
// streams (every incremental-response library), CookieStore (the async cookie
// API that replaces document.cookie), permission and media surfaces, the
// storage manager, AbortSignal statics and WebCrypto operations.

export default [
	basicTest({
		name: "modern-streams-response",
		js: `
			const rs = new ReadableStream({
				start(c) {
					c.enqueue(new TextEncoder().encode("stream"));
					c.enqueue(new TextEncoder().encode("body"));
					c.close();
				},
			});
			assertEqual(await new Response(rs, { headers: { "Content-Type": "text/plain" } }).text(),
				"streambody", "a Response built from a ReadableStream");
			const piped = new Response("abc").body.pipeThrough(new TransformStream({
				transform(chunk, c) { c.enqueue(chunk); },
			}));
			assertEqual(await new Response(piped).text(), "abc", "pipeThrough a TransformStream");
		`,
	}),
	basicTest({
		name: "modern-streams-decoding",
		js: `
			const reader = new Response("decoded-text").body.pipeThrough(new TextDecoderStream()).getReader();
			let out = "";
			for (;;) { const { done, value } = await reader.read(); if (done) break; out += value; }
			assertEqual(out, "decoded-text", "TextDecoderStream");
			const chunks = [];
			await new Response("piped").body.pipeTo(new WritableStream({ write(c) { chunks.push(c); } }));
			assertEqual(new TextDecoder().decode(chunks[0]), "piped", "pipeTo a WritableStream");
		`,
	}),
	basicTest({
		name: "modern-streams-request-body",
		js: `
			const rs = new ReadableStream({
				start(c) { c.enqueue(new TextEncoder().encode("reqstream")); c.close(); },
			});
			const req = new Request("/echo", { method: "POST", body: rs, duplex: "half" });
			assertEqual(req.method, "POST", "method");
			assertEqual(req.url, location.origin + "/echo", "url");
			assertEqual(await req.text(), "reqstream", "a streamed request body is readable");
		`,
	}),
	basicTest({
		name: "modern-cookiestore",
		js: `
			if (typeof cookieStore === "undefined") { pass(); return; }
			await cookieStore.set({ name: "csname", value: "csvalue", path: "/" });
			const got = await cookieStore.get("csname");
			assert(got, "cookieStore.get found the cookie it just set");
			assertEqual(got.value, "csvalue", "value");
			assert(document.cookie.includes("csname=csvalue"),
				"a cookieStore write is visible through document.cookie: " + document.cookie);
			document.cookie = "docname=docvalue; Path=/";
			assert(await cookieStore.get("docname"),
				"a document.cookie write is visible through cookieStore");
			const all = (await cookieStore.getAll()).map((c) => c.name);
			assert(!all.some((n) => n.includes("scramjet")), "no proxy cookies exposed: " + JSON.stringify(all));
			await cookieStore.delete("csname");
			assert(!document.cookie.includes("csname"), "cookieStore.delete: " + document.cookie);
		`,
	}),
	basicTest({
		name: "modern-custom-element-upgrade",
		js: `
			// upgrading an element that was parsed before its definition existed
			const calls = [];
			document.body.insertAdjacentHTML("beforeend", '<up-el id="u" src="/ce.png"></up-el>');
			const el = document.getElementById("u");
			assertEqual(el.constructor, HTMLElement, "not upgraded yet");
			class UpEl extends HTMLElement {
				static get observedAttributes() { return ["src"]; }
				connectedCallback() { calls.push("connected"); }
				attributeChangedCallback(n, o, v) { calls.push("attr:" + n + ":" + v); }
			}
			customElements.define("up-el", UpEl);
			await customElements.whenDefined("up-el");
			assert(el instanceof UpEl, "the parsed element was upgraded in place");
			assert(calls.includes("connected"), "connectedCallback ran on upgrade: " + JSON.stringify(calls));
			assert(calls.includes("attr:src:/ce.png"),
				"attributeChangedCallback sees the author value, not a rewritten one: " + JSON.stringify(calls));
			assertEqual(el.getAttribute("src"), "/ce.png", "attribute");
			assert(el.matches(":defined"), ":defined matches after the upgrade");
		`,
	}),
	basicTest({
		name: "modern-permissions-surface",
		js: `
			assertEqual(typeof Notification, "function", "Notification");
			assertEqual(typeof Notification.permission, "string", "Notification.permission");
			assertEqual(typeof navigator.permissions, "object", "navigator.permissions");
			assertEqual(typeof (await navigator.permissions.query({ name: "geolocation" })).state, "string",
				"permissions.query().state");
			assertEqual(typeof navigator.geolocation, "object", "navigator.geolocation");
			assertEqual(typeof navigator.mediaDevices, "object", "navigator.mediaDevices");
			assertEqual(typeof navigator.clipboard, "object", "navigator.clipboard");
		`,
	}),
	basicTest({
		name: "modern-media-surface",
		js: `
			assertEqual(typeof RTCPeerConnection, "function", "RTCPeerConnection");
			assertEqual(typeof MediaSource, "function", "MediaSource");
			assertEqual(MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'), true, "isTypeSupported");
			const v = document.createElement("video");
			assertEqual(typeof v.canPlayType("video/mp4"), "string", "canPlayType");
			v.src = "/movie.mp4";
			assertEqual(v.src, location.origin + "/movie.mp4", "video.src resolves to the real origin");
			assertEqual(v.getAttribute("src"), "/movie.mp4", "the src attribute keeps the literal value");
			assertEqual(typeof v.play, "function", "play()");
		`,
	}),
	basicTest({
		name: "modern-storage-manager-and-locks",
		js: `
			assertEqual(typeof navigator.storage, "object", "navigator.storage");
			assertEqual(typeof (await navigator.storage.estimate()).quota, "number", "estimate().quota");
			assertEqual(typeof navigator.locks, "object", "navigator.locks");
			assertEqual(await navigator.locks.request("adversarial-lock", async () => "held"), "held",
				"locks.request runs the callback");
		`,
	}),
	basicTest({
		name: "modern-abortsignal-statics",
		js: `
			assertEqual(typeof AbortSignal.timeout, "function", "AbortSignal.timeout");
			const s = AbortSignal.timeout(10);
			await new Promise((r) => s.addEventListener("abort", r));
			assertEqual(s.aborted, true, "the timeout signal aborted");
			assertEqual(s.reason.name, "TimeoutError", "abort reason");
			if (AbortSignal.any) {
				const ac = new AbortController();
				const any = AbortSignal.any([ac.signal]);
				ac.abort();
				assertEqual(any.aborted, true, "AbortSignal.any follows its inputs");
			}
		`,
	}),
	basicTest({
		name: "modern-webcrypto-operations",
		js: `
			const data = new TextEncoder().encode("digest-me");
			assertEqual((await crypto.subtle.digest("SHA-256", data)).byteLength, 32, "SHA-256 digest length");
			const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, true, ["sign", "verify"]);
			const sig = await crypto.subtle.sign("HMAC", key, data);
			assertEqual(await crypto.subtle.verify("HMAC", key, sig, data), true, "HMAC sign then verify");
			const jwk = await crypto.subtle.exportKey("jwk", key);
			assertEqual(jwk.kty, "oct", "exportKey");
		`,
	}),
];

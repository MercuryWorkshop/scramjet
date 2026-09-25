import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-h-nativeness",
		`
		const fns = {
			fetch: window.fetch,
			Request, Response, Headers, WebSocket, EventSource, XMLHttpRequest,
			open: XMLHttpRequest.prototype.open,
			send: XMLHttpRequest.prototype.send,
			getAllResponseHeaders: XMLHttpRequest.prototype.getAllResponseHeaders,
			hget: Headers.prototype.get,
			wsSend: WebSocket.prototype.send,
			createObjectURL: URL.createObjectURL,
			revokeObjectURL: URL.revokeObjectURL,
			sendBeacon: navigator.sendBeacon,
			cookieGet: Object.getOwnPropertyDescriptor(Document.prototype, "cookie").get,
			respUrl: Object.getOwnPropertyDescriptor(Response.prototype, "url").get,
		};
		const bad = [];
		for (const [k, f] of Object.entries(fns)) {
			const s = Function.prototype.toString.call(f);
			if (!/^function [\\w ]*\\(\\) \\{\\s+\\[native code\\]\\s+\\}$/.test(s)) bad.push(k + "=" + s.slice(0, 60));
		}
		assertEqual(bad.join(" | "), "", "all look native");
		const lens = [fetch.length, Request.length, Response.length, Headers.length, WebSocket.length, EventSource.length, XMLHttpRequest.prototype.open.length, URL.createObjectURL.length, navigator.sendBeacon.length].join();
		assertEqual(lens, "1,1,0,0,1,1,2,1,1", "lengths");
		assertEqual([fetch.name, Request.name, WebSocket.name, XMLHttpRequest.prototype.open.name].join(), "fetch,Request,WebSocket,open", "names");
		assertEqual(WebSocket.OPEN + WebSocket.CLOSED + WebSocket.prototype.CLOSING, 1 + 3 + 2, "consts");
		assertEqual(XMLHttpRequest.DONE, 4, "xhr consts");
		assert(Object.getOwnPropertyNames(window).includes("fetch"), "own fetch");
		assert(!Object.getOwnPropertyDescriptor(window, "fetch").enumerable === false, "enumerable fetch");
	`
	),
	t(
		"rv4-h-sentry-style-fetch-detect",
		`
		const isNative = (f) => /^function fetch\\(\\)\\s+\\{\\s+\\[native code\\]\\s+\\}$/.test(f.toString());
		assert(isNative(window.fetch), "sentry isNativeFetch: " + window.fetch.toString());
	`
	),
];

import { basicTest } from "../../testcommon.ts";

// Ported from the message-event worker/iframe choreography around
// data4/payload2_lifted.js:5489-5505 and related message handlers.
//
// The lifted checks install message handlers, post scripted payloads, and then
// inspect event.data plus event routing. This iframe variant focuses on the
// browser MessageEvent shape that is commonly rewritten by proxy runtimes:
// origin, source identity, isTrusted, and ordering.

export default basicTest({
	name: "cf-message-event-roundtrip",
	js: `
		const iframe = document.createElement("iframe");
		const childScript = [
			"window.addEventListener('message', function(e) {",
			"  window.parent.postMessage({",
			"    kind: 'cf-reply',",
			"    seen: {",
			"      payload: e.data,",
			"      origin: e.origin,",
			"      sourceIsParent: e.source === window.parent,",
			"      isTrusted: e.isTrusted",
			"    }",
			"  }, '*');",
			"});",
			"window.parent.postMessage({ kind: 'cf-ready' }, '*');",
		].join("\\n");

		const ready = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("message iframe setup timed out")), 5000);
			const handler = (event) => {
				if (!event.data || event.data.kind !== "cf-ready") return;
				window.removeEventListener("message", handler);
				clearTimeout(timeout);
				resolve();
			};
			window.addEventListener("message", handler);
		});

		iframe.srcdoc = "<!doctype html><script>" + childScript + "<\\/script>";
		document.body.appendChild(iframe);

		try {
			const child = iframe.contentWindow;
			assert(child !== null, "iframe.contentWindow should exist");
			await ready;

			const result = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("message roundtrip timed out")), 5000);
				const handler = (event) => {
					if (!event.data || event.data.kind !== "cf-reply") return;
					window.removeEventListener("message", handler);
					clearTimeout(timeout);
					resolve({
						parentEventOrigin: event.origin,
						parentEventSourceMatchesIframe: event.source === iframe.contentWindow,
						parentEventIsTrusted: event.isTrusted,
						childSeen: event.data.seen,
					});
				};
				window.addEventListener("message", handler);
				child.postMessage({ cmd: "ping", nonce: "zMbJz1" }, "*");
			});

			assert(result.parentEventSourceMatchesIframe === true,
				"parent should see iframe.contentWindow as message source");
			assert(result.childSeen.payload.nonce === "zMbJz1",
				"iframe should receive the posted payload");
			assert(result.childSeen.sourceIsParent === true,
				"iframe should see parent as message source");
			assertConsistent("message-event-parent-origin", result.parentEventOrigin);
			assertConsistent("message-event-parent-source-matches-iframe", result.parentEventSourceMatchesIframe);
			assertConsistent("message-event-parent-is-trusted", result.parentEventIsTrusted);
			assertConsistent("message-event-child-origin", result.childSeen.origin);
			assertConsistent("message-event-child-source-is-parent", result.childSeen.sourceIsParent);
			assertConsistent("message-event-child-is-trusted", result.childSeen.isTrusted);
			assertConsistent("message-event-payload", result.childSeen.payload);
		} finally {
			iframe.remove();
		}
	`,
});

import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv0-origin-self-postmessage-matches-location",
		autoPass: false,
		js: `
			addEventListener("message", (event) => {
				try {
					assertEqual(event.origin, location.origin, "event.origin vs location.origin (doc " + document.URL + ")");
					assertEqual(event.source, window, "source");
					pass();
				} catch (e) { fail(String(e && e.message || e)); }
			});
			postMessage("test", "*");
		`,
	}),
	basicTest({
		name: "rv0-origin-location-vs-document-url",
		js: `
			assertEqual(location.origin, new URL(document.URL).origin, "location.origin vs document.URL origin");
			assertEqual(location.href, document.URL, "location.href vs document.URL");
			assertEqual(window.origin, location.origin, "window.origin");
			assertEqual(self.origin, location.origin, "self.origin");
		`,
	}),
];

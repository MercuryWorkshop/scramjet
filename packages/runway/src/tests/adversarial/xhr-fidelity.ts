import { serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// `requests/XMLHttpRequest.ts` restores the response header list from the
// `x-scramjet-` carriers `rewriteResponseHeaders` wrote. The fetch side of the
// same restoration gates on `box.taggedHeaders`, so a Headers object that
// never came off the wire is left alone; the XHR side has no such gate and
// assumes every response it ever sees carries them. Anything that reaches XHR
// without going through the rewriter therefore reads back as a response with
// no headers at all.

export default [
	// A `data:` URL response is synthesized rather than fetched, and its
	// Content-Type is the one thing a page reads off it.
	serverTest({
		name: "xhrfidelity-data-url-response-headers",
		autoPass: false,
		js: `
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "data:text/plain,xhrfidelity");
			xhr.onload = () => {
				const type = xhr.getResponseHeader("content-type");
				const all = xhr.getAllResponseHeaders();
				assertEqual(xhr.responseText, "xhrfidelity", "the body arrives");
				assert(
					type !== null,
					"getResponseHeader('content-type') is not null for a data: URL"
				);
				assert(
					all.length > 0,
					"getAllResponseHeaders() is not empty for a data: URL"
				);
				pass();
			};
			xhr.onerror = () => fail("data: URL request errored");
			xhr.send();
		`,
		async start() {},
	}),

	// The same through a Blob URL, which is the other response a page can
	// produce without the network.
	serverTest({
		name: "xhrfidelity-blob-url-response-headers",
		autoPass: false,
		js: `
			const url = URL.createObjectURL(
				new Blob(["xhrfidelity-blob"], { type: "text/plain" })
			);
			const xhr = new XMLHttpRequest();
			xhr.open("GET", url);
			xhr.onload = () => {
				const type = xhr.getResponseHeader("content-type");
				assertEqual(xhr.responseText, "xhrfidelity-blob", "the body arrives");
				assert(
					type !== null,
					"getResponseHeader('content-type') is not null for a blob: URL"
				);
				pass();
			};
			xhr.onerror = () => fail("blob: URL request errored");
			xhr.send();
		`,
		async start() {},
	}),

	// https://fetch.spec.whatwg.org/#concept-header-list-sort-and-combine
	//
	// The list is sorted by *name*. Sorting the whole "name: value" lines puts
	// a name that another one prefixes after it, because "-" sorts before ":".
	serverTest({
		name: "xhrfidelity-all-response-headers-sorted-by-name",
		autoPass: false,
		js: `
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/prefixed-names");
			xhr.onload = () => {
				const names = xhr
					.getAllResponseHeaders()
					.split("\\r\\n")
					.filter(Boolean)
					.map((line) => line.slice(0, line.indexOf(":")));
				const csp = names.indexOf("content-security-policy");
				const reportOnly = names.indexOf("content-security-policy-report-only");
				assert(csp !== -1 && reportOnly !== -1, "both headers are listed: " + names.join(","));
				assert(csp < reportOnly, "sorted by name: " + names.join(","));
				pass();
			};
			xhr.onerror = () => fail("request errored");
			xhr.send();
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path !== "/prefixed-names") return;
				res.writeHead(200, {
					"Content-Type": "text/plain",
					"Content-Security-Policy": "default-src *",
					"Content-Security-Policy-Report-Only": "default-src 'self'",
				});
				res.end("ok");
			});
		},
	}),
];

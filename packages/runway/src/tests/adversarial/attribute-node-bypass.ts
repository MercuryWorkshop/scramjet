import { serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// `dom/element.ts` rewrites URL-bearing attributes in `setAttribute` and
// `setAttributeNS`, and `dom/attr.ts` routes `Attr.value` back through
// `setAttribute` - but only for an Attr that already has an `ownerElement`.
//
// `Element.prototype.setAttributeNode` is intercepted with an empty body
// ("i actually need to do something with this"), so the other order goes
// through no rewriter at all:
//
//   const attr = document.createAttribute("src");
//   attr.value = "https://origin.example/x.js";   // detached: not rewritten
//   script.setAttributeNode(attr);                // attached: not rewritten
//
// The element then holds the site's real URL in its live `src`. Today the
// service worker catches the resulting load anyway - it is in scope, and it
// resolves an unprefixed URL against the client's own site - so nothing
// escapes. That is the only thing standing between this hole and a
// subresource fetched from the user's own address, and nothing in
// `dom/element.ts` says so, so it is worth a guard.
//
// The server is the oracle: a request scramjet issued arrives with the
// *site's* URL as its Referer, and one the browser issued from the proxy
// document arrives with the proxy's. Nothing the page can read tells them
// apart - `getAttribute`, `getAttributeNames` and `outerHTML` all report the
// site's URL either way - so the network is the only place to look.
//
// NOTE: this reproduces under `RUNWAY_FAST=1`, where the harness instance is
// reused, and not in a cold harness - the escape depends on whether the
// service worker happens to be controlling the document when the load is
// kicked off. That the outcome turns on SW timing is the point: the rewriter
// is not what is keeping the URL inside the proxy.

export default [
	serverTest({
		name: "attrnode-setattributenode-is-rewritten",
		autoPass: false,
		js: `
			const script = document.createElement("script");
			const attr = document.createAttribute("src");
			attr.value = location.origin + "/attrnode-probe.js";
			script.setAttributeNode(attr);
			document.body.appendChild(script);
		`,
		async start(server, port, ctx) {
			server.on("request", (req, res) => {
				if (!req.url || !req.url.startsWith("/attrnode-probe.js")) return;

				const referer = req.headers.referer ?? "";
				res.writeHead(200, { "Content-Type": "application/javascript" });
				res.end("");

				// a request scramjet issued carries the *site's* URL as its
				// Referer; one the browser issued straight from the proxy
				// document carries the proxy's
				if (referer.includes("/~/sj/") || referer.includes(":4500")) {
					ctx.fail(
						"the subresource was fetched outside the proxy (Referer=" +
							referer +
							")"
					);
				} else {
					ctx.pass();
				}
			});
		},
	}),

	// The control: the same load written with `setAttribute`, which is
	// rewritten. A harness change that made every Referer look proxied would
	// pass the test above and leave this one indistinguishable, so it is here
	// to show the signal is real.
	serverTest({
		name: "attrnode-setattribute-is-rewritten",
		autoPass: false,
		js: `
			const script = document.createElement("script");
			script.setAttribute("src", location.origin + "/attrnode-control.js");
			document.body.appendChild(script);
		`,
		async start(server, port, ctx) {
			server.on("request", (req, res) => {
				if (!req.url || !req.url.startsWith("/attrnode-control.js")) return;

				const referer = req.headers.referer ?? "";
				res.writeHead(200, { "Content-Type": "application/javascript" });
				res.end("");

				// a request scramjet issued carries the *site's* URL as its
				// Referer; one the browser issued straight from the proxy
				// document carries the proxy's
				if (referer.includes("/~/sj/") || referer.includes(":4500")) {
					ctx.fail(
						"the subresource was fetched outside the proxy (Referer=" +
							referer +
							")"
					);
				} else {
					ctx.pass();
				}
			});
		},
	}),
];

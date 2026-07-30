import { serverTest } from "../../testcommon.ts";

// Two different sites viewed through the same proxy share one *real* browser
// origin, so the browser's own same-origin policy no longer separates them.
// Keeping them apart becomes the proxy's job, and it is only partly done:
// request-time cookie scoping is enforced, but a frame belonging to another
// proxied site is fully readable from script - its DOM, its cookie jar and its
// location all read out.
//
// That is architectural rather than a small bug: real separation needs a
// distinct browser origin per proxied site. It is worth pinning down anyway,
// because it is the difference between "a site renders wrong" and "one site can
// read another site's session".
//
// This is a single test on purpose. It needs `hostname`, and consecutive
// hostname-based tests interfere in the harness - the second one wedges until it
// times out - so the working and broken halves are asserted on one page, working
// half first, so that a regression in request scoping surfaces as a different
// failure message rather than hiding behind the known one.

export default [
	serverTest({
		// KNOWN FAILURE: the cross-site frame assertions below. Everything before
		// them currently holds.
		name: "originisolation-cross-site-frame-access",
		hostname: "a.example",
		cleartextHosts: ["b.example"],
		autoPass: true,
		js: `
			// --- what works today ---
			assertEqual(location.hostname, "a.example", "the page believes it is a.example");
			assertEqual(location.origin, "https://a.example", "and reports that origin");
			assertEqual(window.origin, location.origin, "window.origin agrees");
			document.cookie = "acookie=avalue; Path=/";
			await new Promise((r) => setTimeout(r, 400));
			const j = await (await fetch("https://b.example/echo", { credentials: "include" })).json();
			assertEqual(j.host, "b.example", "the cross-site request really reached b.example");
			assert(!String(j.cookie || "").includes("acookie"),
				"a.example's cookie must not be sent to b.example: " + JSON.stringify(j.cookie));

			// --- what does not ---
			const f = document.createElement("iframe");
			f.src = "https://b.example/frame.html";
			document.body.appendChild(f);
			await new Promise((r) => { f.onload = r; setTimeout(r, 4000); });
			const probe = (fn) => { try { return fn(); } catch { return "BLOCKED"; } };
			const doc = probe(() => f.contentDocument);

			assertEqual(doc === null || doc === "BLOCKED", true,
				"contentDocument of a cross-site frame must not be reachable");
			assertEqual(probe(() => f.contentDocument.getElementById("secret").textContent), "BLOCKED",
				"the other site's DOM must not be readable");
			assertEqual(probe(() => f.contentDocument.cookie), "BLOCKED",
				"the other site's cookies must not be readable - note the same cookie is correctly " +
				"withheld from cross-site requests above");
			assertEqual(probe(() => f.contentWindow.location.href), "BLOCKED",
				"the other site's location must not be readable");
			assertEqual(probe(() => f.contentWindow.origin), "BLOCKED",
				"the other site's origin must not be readable");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/frame.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Set-Cookie": "bsecret=bvalue; Path=/",
					});
					res.end(
						'<!DOCTYPE html><html><body><p id="secret">B-SIDE-SECRET</p></body></html>'
					);
					return;
				}
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "https://a.example",
					"Access-Control-Allow-Credentials": "true",
				});
				res.end(
					JSON.stringify({
						host: req.headers.host,
						cookie: req.headers.cookie ?? null,
					})
				);
			});
		},
	}),
];

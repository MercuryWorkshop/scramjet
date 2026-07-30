import { serverTest } from "../../testcommon.ts";

// document.cookie is emulated against the proxy's own jar, so a script write
// has to be reflected in two places: back through document.cookie, and in the
// Cookie header of subsequent requests.
//
// Existing coverage (tests/cookies.ts) checks the server-to-script direction.
// These go the other way, which is the direction the classic pattern uses:
//   document.cookie = "csrftoken=…"; fetch("/api", {method: "POST"})
//
// The write reaches the jar asynchronously, so a request issued in the same task
// can go out without the cookie - reproducible on an idle machine with either
// fetch or a synchronous XHR, but it stops reproducing under load, so it is not
// asserted here. What is asserted is the shape around it: the cookie is present
// after a short delay, and after any intervening request.

const jarTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/setcookie") {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Set-Cookie": "srv=srvvalue; Path=/",
					});
					res.end("ok");
					return;
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cookie: req.headers.cookie ?? null }));
			});
		},
	});

export default [
	jarTest(
		"ckjar-write-then-read",
		`
			document.cookie = "a=1";
			assert(document.cookie.includes("a=1"), "document.cookie reads back its own write: " + document.cookie);
			document.cookie = "b=2; Path=/";
			assert(document.cookie.includes("b=2"), "a second cookie: " + document.cookie);
			assert(document.cookie.includes("a=1"), "the first one survives: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-overwrite",
		`
			document.cookie = "o=first; Path=/";
			document.cookie = "o=second; Path=/";
			const matches = document.cookie.split("; ").filter((c) => c.startsWith("o="));
			assertDeepEqual(matches, ["o=second"], "overwriting replaces rather than duplicates: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-delete",
		`
			document.cookie = "d=1; Path=/";
			assert(document.cookie.includes("d=1"), "precondition: " + document.cookie);
			document.cookie = "d=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
			assert(!document.cookie.includes("d=1"), "an expired cookie is gone: " + document.cookie);
			document.cookie = "e=1; Path=/";
			document.cookie = "e=1; Path=/; Max-Age=0";
			assert(!document.cookie.includes("e=1"), "Max-Age=0 removes it: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-path-scoping",
		`
			document.cookie = "scoped=v; Path=/deep/other";
			assert(!document.cookie.includes("scoped=v"),
				"a cookie scoped to another path must not be readable here: " + document.cookie);
			document.cookie = "here=v; Path=/";
			assert(document.cookie.includes("here=v"), "Path=/ is readable: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-value-encoding",
		`
			document.cookie = "enc=" + encodeURIComponent("a b&c=d");
			assert(document.cookie.includes("enc=a%20b%26c%3Dd"), "an encoded value round trips verbatim: " + document.cookie);
			document.cookie = "eq=x=y; Path=/";
			assert(document.cookie.includes("eq=x=y"), "a value containing = is preserved: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-server-cookie-sent",
		`
			await fetch("/setcookie");
			const j = await (await fetch("/echo")).json();
			assert((j.cookie || "").includes("srv=srvvalue"), "a server-set cookie is sent: " + JSON.stringify(j.cookie));
			assert(document.cookie.includes("srv=srvvalue"), "and is visible to script: " + document.cookie);
		`
	),
	jarTest(
		"ckjar-script-cookie-sent-eventually",
		`
			// the companion to ckjar-script-cookie-sent-immediately: the write does
			// arrive, it just isn't in place for a request made in the same tick
			document.cookie = "later=v; Path=/";
			await new Promise((r) => setTimeout(r, 300));
			const j = await (await fetch("/echo")).json();
			assert((j.cookie || "").includes("later=v"), "sent after a delay: " + JSON.stringify(j.cookie));
		`
	),
	jarTest(
		"ckjar-script-cookie-sent-after-request",
		`
			document.cookie = "afterreq=v; Path=/";
			await fetch("/echo");
			const j = await (await fetch("/echo")).json();
			assert((j.cookie || "").includes("afterreq=v"), "sent on the second request: " + JSON.stringify(j.cookie));
		`
	),

	// ------------------------------------------------------------------
];

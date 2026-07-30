import { serverTest } from "../../testcommon.ts";

// Every URL a page requests is encoded into the proxy's own URL and decoded
// again on the way out, so the origin has to receive exactly what the page asked
// for. Double-decoding an encoded slash, dropping an empty query or reordering
// duplicate parameters are the classic ways a proxy breaks signed URLs, REST
// routes and pagination.
//
// The server echoes its raw request line, so these compare byte for byte.

const rawTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ raw: req.url }));
			});
		},
	});

const RAW = `const raw = async (u) => (await (await fetch(u)).json()).raw;`;

export default [
	rawTest(
		"urlfidelity-path",
		`
			${RAW}
			assertEqual(await raw("/a/b"), "/a/b", "a plain path");
			assertEqual(await raw("/a//b"), "/a//b", "a double slash is preserved");
			assertEqual(await raw("/a/./b"), "/a/b", "a dot segment is normalised by the URL parser");
			assertEqual(await raw("/a/%2Fb"), "/a/%2Fb", "an encoded slash must stay encoded");
			assertEqual(await raw("/a%20b"), "/a%20b", "an encoded space");
			assertEqual(await raw("/a+b"), "/a+b", "a plus in the path is literal");
			assertEqual(await raw("/a%25b"), "/a%25b", "an encoded percent stays singly encoded");
			assertEqual(await raw("/a%3Fb"), "/a%3Fb", "an encoded question mark stays encoded");
			assertEqual(await raw("/a%23b"), "/a%23b", "an encoded hash stays encoded");
			assertEqual(await raw("/~tilde"), "/~tilde", "a tilde");
			assertEqual(await raw("/a:b"), "/a:b", "a colon in the path");
			assertEqual(await raw("/a@b"), "/a@b", "an at sign in the path");
		`
	),
	rawTest(
		"urlfidelity-query",
		`
			${RAW}
			assertEqual(await raw("/q?a=1"), "/q?a=1", "a simple query");
			assertEqual(await raw("/q?a=1&a=2"), "/q?a=1&a=2", "duplicate keys keep their order");
			assertEqual(await raw("/q?a"), "/q?a", "a valueless key");
			assertEqual(await raw("/q?a="), "/q?a=", "an empty value");
			assertEqual(await raw("/q?a=%26b"), "/q?a=%26b", "an encoded ampersand stays encoded");
			assertEqual(await raw("/q?a=b+c"), "/q?a=b+c", "a plus in the query is preserved");
			assertEqual(await raw("/q?a=b%20c"), "/q?a=b%20c", "an encoded space in the query");
			assertEqual(await raw("/q?a=b/c"), "/q?a=b/c", "a slash in a query value");
			assertEqual(await raw("/q?a=b=c"), "/q?a=b=c", "an equals in a query value");
			assertEqual(await raw("/q?a=1#frag"), "/q?a=1", "the fragment is not sent to the origin");
		`
	),
	rawTest(
		"urlfidelity-proxy-parameter-collision",
		`
			${RAW}
			// query keys that collide with the proxy's own URL parameters
			assertEqual(await raw("/q?$io=hijack"), "/q?$io=hijack", "a $io parameter is passed through");
			assertEqual(await raw("/q?$module=module"), "/q?$module=module", "a $module parameter");
			assertEqual(await raw("/q?a=1&$io=x&b=2"), "/q?a=1&$io=x&b=2", "in the middle of a real query");
		`
	),
	rawTest(
		"urlfidelity-unicode",
		`
			${RAW}
			const eacute = String.fromCharCode(233);
			assertEqual(await raw("/caf" + eacute), "/caf%C3%A9", "a non-ASCII path is UTF-8 percent-encoded");
			assertEqual(await raw("/q?name=caf" + eacute), "/q?name=caf%C3%A9", "a non-ASCII query value");
			assertEqual(await raw("/%E2%98%83"), "/%E2%98%83", "an already-encoded snowman stays as-is");
			assertEqual(await raw("/q?emoji=" + encodeURIComponent(String.fromCodePoint(128512))),
				"/q?emoji=%F0%9F%98%80", "an encoded emoji");
		`
	),

	// ------------------------------------------------------------------
	rawTest(
		// KNOWN FAILURE: a trailing "?" with no parameters is dropped, so the
		// origin sees /q instead of /q?. Frameworks that branch on "was there a
		// query string at all", and anything that canonicalises or signs the
		// request line, see a different URL than the page asked for.
		"urlfidelity-empty-query",
		`
			${RAW}
			assertEqual(await raw("/q?"), "/q?", "an empty query string is preserved");
			assertEqual(await raw("/q?#"), "/q?", "an empty query with an empty fragment");
		`
	),
];

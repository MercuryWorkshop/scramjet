import { serverTest } from "../testcommon.ts";

// A GET form's query is its fields, in order, every one of them: two checked
// boxes with one name are two pairs, and the action's own query is replaced
export default [
	serverTest({
		// one server serves both harnesses; this checks what scramjet sends
		scramjetOnly: true,
		name: "form-get-repeated-names-and-action-query",
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				const url = new URL(req.url ?? "/", "http://x");
				if (url.pathname === "/") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html><form id="f" method="get" action="/search?old=1">
<input type="checkbox" name="brand" value="A" checked>
<input type="checkbox" name="brand" value="B" checked>
<input name="q" value="shoes">
</form><script>document.getElementById("f").requestSubmit()</script>`);
				} else if (url.pathname === "/search") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("ok");
					const got = url.search;
					if (got === "?brand=A&brand=B&q=shoes") pass("all fields, in order");
					else fail("query was " + got);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];

import { serverTest } from "../../../testcommon.ts";

// pushState/replaceState resolve a relative URL against the document's *base URL*
// (https://html.spec.whatwg.org/#shared-history-push/replace-state-steps step 2),
// so a <base href> changes where a relative state URL points.
export default [
	serverTest({
		name: "rv7-history-base-href",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(302, {
						Location: "/deep/dir/page.html",
					});
					res.end();
				} else if (req.url && req.url.startsWith("/deep/dir/page.html")) {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><html><head><base href="/app/"></head><body><script>
runTest(async () => {
	const r = [];
	history.pushState(null, '', 'next');
	r.push(location.pathname);
	history.replaceState(null, '', '?page=2');
	r.push(location.pathname + location.search);
	history.pushState(null, '', '../up');
	r.push(location.pathname);
	assertEqual(JSON.stringify(r), JSON.stringify(['/app/next', '/app/?page=2', '/up']), 'relative state URLs resolve against <base href>');
	pass();
}, false);
</script></body></html>`);
				}
			});
		},
	}),
];

import { serverTest } from "../../../testcommon.ts";

// Cloudflare Turnstile with Cloudflare's always-pass test sitekey: the widget
// should load, run, and hand the page a token
export default [
	serverTest({
		name: "v3-turnstile-test-sitekey",
		timeoutMs: 40000,
		start: async (server) => {
			server.on("request", (req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><html><body>
<div class="cf-turnstile" data-sitekey="1x00000000000000000000AA" data-callback="ok" data-error-callback="bad"></div>
<script>
	window.ok = (t) => runTest(async () => { assertConsistent("token", typeof t === "string" && t.length > 10); }, true);
	window.bad = (e) => runTest(async () => { assertConsistent("token", "error:" + e); }, true);
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</body></html>`);
			});
		},
	}),
];

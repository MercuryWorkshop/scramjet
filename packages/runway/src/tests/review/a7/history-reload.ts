import { serverTest } from "../../../testcommon.ts";

// SPA pattern: pushState to a deep link, then reload. The reloaded document must
// be the deep link, with the query intact and nothing proxy-shaped in location.
const child = `<!doctype html><script>
if (!location.search.includes('x=1')) {
	history.pushState({k: 1}, '', '/child/deep?x=1#h');
	location.reload();
} else {
	parent.postMessage(JSON.stringify([location.pathname, location.search, location.hash, document.URL, history.state && history.state.k]), '*');
}
</script>`;

export default [
	serverTest({
		name: "rv7-history-push-reload",
		js: `
			const got = await new Promise((resolve) => {
				addEventListener('message', (e) => resolve(e.data));
				const f = document.createElement('iframe');
				f.src = '/child/start';
				document.body.appendChild(f);
				setTimeout(() => resolve('TIMEOUT'), 8000);
			});
			const [p, s, h, u, k] = JSON.parse(got);
			assertEqual(JSON.stringify([p, s, h, k]), JSON.stringify(['/child/deep', '?x=1', '#h', 1]), 'reloaded deep link');
			assertEqual(u, location.origin + '/child/deep?x=1#h', 'document.URL after reload');
			pass();
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url && req.url.startsWith("/child")) {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(child);
				}
			});
		},
	}),
];

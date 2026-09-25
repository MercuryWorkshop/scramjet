import { serverTest } from "../../../testcommon.ts";

// A sandboxed (opaque-origin) child page doing SPA-style history updates.
// Natively these succeed: "can have its URL rewritten" compares scheme/host/port,
// not origin.
const child = `<!doctype html><script>
const r = [];
try { history.replaceState({a:1}, '', location.href); r.push('replace-ok'); } catch (e) { r.push('replace-' + e.name); }
try { history.pushState(null, '', '/child/route?x=1'); r.push('push-ok ' + location.pathname); } catch (e) { r.push('push-' + e.name); }
try { history.replaceState(null, ''); r.push('nourl-ok'); } catch (e) { r.push('nourl-' + e.name); }
parent.postMessage(JSON.stringify(r), '*');
</script>`;

export default [
	serverTest({
		name: "rv7-history-sandboxed-iframe",
		js: `
			const got = await new Promise((resolve) => {
				addEventListener('message', (e) => resolve(e.data));
				const f = document.createElement('iframe');
				f.sandbox = 'allow-scripts';
				f.src = '/child';
				document.body.appendChild(f);
				setTimeout(() => resolve('TIMEOUT'), 8000);
			});
			assertEqual(got, JSON.stringify(['replace-ok', 'push-ok /child/route', 'nourl-ok']), 'sandboxed iframe history');
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

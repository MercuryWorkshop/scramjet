import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv7-docwrite-during-parse",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><html><head>
<script>document.write('<script src="/ext.js"><\\/script>');</script>
<script>document.write('<link rel="stylesheet" href="/dw.css"><style>.dws{background:url(/dws.png)}</style>');</script>
<script>document.writeln('<p id="wl">written</p>'); window.__afterWrite = typeof window.__ext;</script>
</head><body>
<div id="x" style="background:url(/x.png)"></div>
<script>document.write('<img id="dwimg" src="/dw.png">');</script>
<script>
runTest(async () => {
	assertEqual(window.__ext, 'loaded', 'external script written during parse ran');
	assertEqual(window.__afterWrite, 'string', 'written script ran synchronously before the next script');
	assert(document.getElementById('wl'), 'writeln paragraph exists');
	assertEqual(document.getElementById('dwimg').getAttribute('src'), '/dw.png', 'img src reads back');
	const img = document.getElementById('dwimg');
	await new Promise(r => img.complete ? r() : (img.onload = img.onerror = r));
	assert(img.naturalWidth === 1, 'written image loaded through proxy');
	const st = [...document.querySelectorAll('style')].find(s => s.textContent.includes('dws'));
	assert(st && st.sheet.cssRules[0].cssText.includes('dws.png'), 'written style parsed');
	pass();
}, false);
</script></body></html>`);
				} else if (req.url === "/ext.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end("window.__ext = 'loaded';");
				} else if (req.url === "/dw.png") {
					res.writeHead(200, {
						"Content-Type": "image/gif",
					});
					res.end(
						Buffer.from(
							"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
							"base64"
						)
					);
				} else if (req.url && req.url !== "/script.js") {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];

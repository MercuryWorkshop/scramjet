import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv11-xhr-document-adopt",
		start: async (server) => {
			const hits: string[] = [];
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				hits.push(path);
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><body><div id=host></div><script>
					runTest(async () => {
						const out = {};
						const doc = await new Promise(r => { const x = new XMLHttpRequest(); x.open('GET', '/frag.html'); x.responseType = 'document'; x.onload = () => r(x.response); x.send(); });
						out.docURL = doc.URL.slice(0, 60);
						const a = doc.getElementById('xa'), img = doc.getElementById('xi');
						out.inert = [a.getAttribute('href'), a.href, img.getAttribute('src'), img.src];
						const host = document.getElementById('host');
						for (const n of Array.from(doc.body.childNodes)) host.appendChild(document.adoptNode(n));
						await new Promise(r => setTimeout(r, 800));
						out.live = [document.getElementById('xa').getAttribute('href'), document.getElementById('xa').href, document.getElementById('xi').getAttribute('src'), document.getElementById('xi').src];
						out.bg = getComputedStyle(document.getElementById('xs')).color;
						out.hits = await (await fetch('/__hits')).json();
						console.log('RV11PROBE ' + JSON.stringify({"rv11-xhr-document-adopt": out}));
						fail('RV11PROBE ' + JSON.stringify({"rv11-xhr-document-adopt": out}));
					}, false);
					</script></body>`);
				} else if (path === "/frag.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><html><head><link rel=stylesheet href="/xhr-style.css"></head><body><a id=xa href="/xhr-link">l</a><img id=xi src="/xhr-img.png"><link rel=stylesheet href="/xhr-body.css"><p id=xs>s</p><iframe src="/xhr-frame"></iframe></body></html>`
					);
				} else if (path === "/__hits") {
					res.writeHead(200, {
						"Content-Type": "application/json",
					});
					res.end(JSON.stringify(hits.filter((h) => h.startsWith("/xhr"))));
				} else if (path.endsWith(".css")) {
					res.writeHead(200, {
						"Content-Type": "text/css",
					});
					res.end("#xs{color:rgb(4,5,6)}");
				} else {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("x");
				}
			});
		},
	}),
];

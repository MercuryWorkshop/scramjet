import { serverTest } from "../../../testcommon.ts";

// a consent manager's blocked script: shipped as text/plain, enabled later
export default [
	serverTest({
		name: "v3-consent-script-enable",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/ext.js") {
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end('window.rc = location.pathname + "|" + document.domain;');
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><html><head>
<script type="text/plain" id=a data-consent="stats">window.ra = location.pathname + "|" + document.domain;</script>
<script type="text/plain" id=b data-consent="stats">window.rb = location.pathname + "|" + document.domain;</script>
<script type="text/plain" id=c data-consent="stats" src="/ext.js"></script>
</head><body><script>
runTest(async () => {
	// copy into a fresh element, the common way
	const a = document.getElementById("a");
	const n = document.createElement("script");
	n.type = "text/javascript";
	n.textContent = a.textContent;
	a.replaceWith(n);
	// flip the type on the original and re-insert it
	const b = document.getElementById("b");
	b.type = "text/javascript";
	b.remove();
	document.head.append(b);
	// external, via attribute flip + clone
	const c = document.getElementById("c");
	const nc = document.createElement("script");
	nc.src = c.getAttribute("src");
	await new Promise((r) => { nc.onload = nc.onerror = r; document.head.append(nc); });
	assertConsistent("copy", window.ra ?? "not run");
	assertConsistent("flip", window.rb ?? "not run");
	assertConsistent("ext", window.rc ?? "not run");
	assertConsistent("text", [a.textContent, b.textContent]);
}, true);
</script></body></html>`);
			});
		},
	}),
];

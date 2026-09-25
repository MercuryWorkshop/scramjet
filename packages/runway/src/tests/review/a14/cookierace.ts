import { serverTest } from "../../../testcommon.ts";

// document.cookie = x immediately followed by a request: does the request carry x?
// (cookie writes reach the SW's jar through an async message)
export default [
	serverTest({
		name: "rv14-cookie-race",
		async start(server) {
			server.on("request", (req, res) => {
				const p = req.url!.split("?")[0];
				if (p === "/echo") {
					res.writeHead(200, {
						"content-type": "text/plain",
						"cache-control": "no-store",
					});
					res.end(req.headers.cookie || "(none)");
					return;
				}
				if (p === "/child.html") {
					res.writeHead(200, {
						"content-type": "text/html",
						"cache-control": "no-store",
					});
					res.end(
						"<!DOCTYPE html><html><body><script>window.__ck = " +
							JSON.stringify(req.headers.cookie || "(none)") +
							";</script></body></html>"
					);
					return;
				}
				if (p !== "/") {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!DOCTYPE html><html><body><script>
runTest(async () => {
  const has = (s, k) => String(s).split("; ").includes(k);
  document.cookie = "r1=1; path=/";
  const f1 = await (await fetch("/echo?1")).text();
  assertConsistent("fetch-immediately", has(f1, "r1=1"));
  document.cookie = "r2=1; path=/";
  const x = await new Promise((res) => { const q = new XMLHttpRequest(); q.open("GET", "/echo?2"); q.onload = () => res(q.responseText); q.send(); });
  assertConsistent("xhr-immediately", has(x, "r2=1"));
  document.cookie = "r3=1; path=/";
  const fr = document.createElement("iframe"); fr.src = "/child.html";
  await new Promise((r) => { fr.onload = r; document.body.appendChild(fr); });
  assertConsistent("iframe-nav-immediately", has(fr.contentWindow.__ck, "r3=1"));
  document.cookie = "r4=1; path=/";
  await new Promise((r) => setTimeout(r, 300));
  const f4 = await (await fetch("/echo?4")).text();
  assertConsistent("fetch-after-300ms", has(f4, "r4=1"));
}, true);
</script></body></html>`);
			});
		},
	}),
];

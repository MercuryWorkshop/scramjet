import { serverTest } from "../../../testcommon.ts";

// Attributes the browser fetches from that have no htmlRules entry. For each
// resource, the test server records whether it was requested, and whether the
// request came through the proxy (Referer = site) or straight from the page
// at the proxy origin (Referer carries the proxy's /~/sj/ URL): "missing",
// "ok" or "direct".

const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const IDS = [
	"body-bg",
	"table-bg",
	"td-bg",
	"attributionsrc",
	"ping",
	"abs-body-bg",
	"input-image",
	"svg-feimage",
	"video-poster-abs",
	"link-icon",
	"abs-attributionsrc",
	"abs-ping",
];

export default [
	(() => {
		const seen: Record<string, Record<string, string>> = {};
		let n = 0;
		const t = serverTest({
			name: "rv13-fetchattrs",
			async start(server, port) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					const id = u.searchParams.get("id");
					const tok = u.searchParams.get("t") || "";
					if (id) {
						const ref = String(req.headers["referer"] || "");
						(seen[tok] ||= {})[id] = /~\/sj\/|localhost:(8000|8100)/.test(ref)
							? "direct"
							: "ok";
						res.writeHead(200, {
							"Content-Type": "image/png",
							"Access-Control-Allow-Origin": "*",
						});
						res.end(Buffer.from(PNG, "base64"));
						return;
					}
					if (u.pathname === "/log") {
						res.writeHead(200, {
							"Content-Type": "application/json",
							"Cache-Control": "no-store",
						});
						res.end(JSON.stringify(seen[tok] || {}));
						return;
					}
					if (u.pathname === "/") {
						const T = "t" + ++n;
						const abs = `http://localhost:${port}`;
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!doctype html><body background="/r.png?t=${T}&id=body-bg">
<table background="/r.png?t=${T}&id=table-bg"><tr><td background="/r.png?t=${T}&id=td-bg">x</td></tr></table>
<img attributionsrc="/r.png?t=${T}&id=attributionsrc" src="/r.png?t=${T}&id=img-plain">
<a id=pinger href="#p" ping="/r.png?t=${T}&id=ping">ping</a>
<div id=abs></div><img attributionsrc="${abs}/r.png?t=${T}&id=abs-attributionsrc" src="/r.png?t=${T}&id=img-plain2"><a id=pinger2 href="#q" ping="${abs}/r.png?t=${T}&id=abs-ping">p2</a>
<input type=image src="/r.png?t=${T}&id=input-image">
<svg width=10 height=10><filter id=fl><feImage href="/r.png?t=${T}&id=svg-feimage"/></filter><rect width=10 height=10 filter="url(#fl)"/></svg>
<video poster="${abs}/r.png?t=${T}&id=video-poster-abs"></video>
<link rel=icon href="/r.png?t=${T}&id=link-icon">
<script>
runTest(async () => {
	document.getElementById("abs").innerHTML = '<table background="${abs}/r.png?t=${T}&id=abs-body-bg"><tr><td>y</td></tr></table>';
	document.getElementById("pinger").click(); document.getElementById("pinger2").click();
	await new Promise((r) => setTimeout(r, 2500));
	const log = await (await fetch("/log?t=${T}")).json();
	for (const id of ${JSON.stringify(IDS)}) assertConsistent(id, log[id] || "missing");
}, true);
</script></body>`);
						return;
					}
					res.writeHead(404);
					res.end();
				});
			},
		});
		t.timeoutMs = 60000;
		return t;
	})(),
];

import { hdrTest } from "./nonce.ts";

const probe = `<!DOCTYPE html><script>
const r = { k: location.pathname };
r.topIsSelf = window.top === window.self; r.parentIsSelf = window.parent === window.self; r.selfIsWindow = self === window;
try { r.fe = window.frameElement === null ? "null" : window.frameElement.nodeName; } catch (e) { r.fe = "ERR " + e.name; }
try { r.topHref = top.location.href.replace(/:\\d+/, ":P"); } catch (e) { r.topHref = "ERR " + e.name; }
try { r.topOrigin = top.origin; } catch (e) { r.topOrigin = "ERR " + e.name; }
try { r.parentDoc = typeof parent.document; } catch (e) { r.parentDoc = "ERR " + e.name; }
try { top.location.hash = "#bust"; r.bustHash = "ok"; } catch (e) { r.bustHash = "ERR " + e.name; }
r.len = top.length;
r.inIframeCheck = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
parent.postMessage(r, "*");
</script>`;

const js = `
runTest(async () => {
	const X = "http://127.0.0.1:" + location.port;
	const got = {};
	addEventListener("message", e => { if (e.data && e.data.k) got[e.data.k] = e.data; });
	for (const src of ["/same.html", X + "/cross.html"]) { const f = document.createElement("iframe"); f.src = src; document.body.append(f); }
	await new Promise(r => setTimeout(r, 1500));
	const out = { frames: got, hash: location.hash };
	assertConsistent("framing", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-framing",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
			"/same.html": {
				body: probe,
			},
			"/cross.html": {
				body: probe,
			},
		},
	}),
];

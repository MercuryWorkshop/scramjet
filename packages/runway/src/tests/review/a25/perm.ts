import { hdrTest } from "./nonce.ts";

const frameJs = `<!DOCTYPE html><script>
parent.postMessage({ k: location.pathname, fs: document.fullscreenEnabled,
 fp: document.featurePolicy ? ["camera","fullscreen","autoplay","clipboard-write","payment","geolocation","microphone"].map(f => f + "=" + document.featurePolicy.allowsFeature(f)) : null,
 pip: document.pictureInPictureEnabled }, "*");
</script>`;

const js = `
runTest(async () => {
	const out = {};
	const X = "http://127.0.0.1:" + location.port;
	const msgs = {};
	addEventListener("message", e => { if (e.data && e.data.k) msgs[e.data.k] = e.data; });
	const mk = (src, attrs) => { const f = document.createElement("iframe"); for (const [k, v] of Object.entries(attrs)) f.setAttribute(k, v); f.src = src; document.body.append(f); return f; };
	const a = mk("/f1.html", { allow: "fullscreen; autoplay; camera 'none'; clipboard-write", allowfullscreen: "" });
	const b = mk(X + "/f2.html", { allow: "fullscreen *; autoplay *; camera; payment", allowfullscreen: "" });
	const c = mk(X + "/f3.html", {});
	const d = document.createElement("iframe"); d.allow = "geolocation"; d.allowFullscreen = true; d.src = X + "/f4.html"; document.body.append(d);
	await new Promise(r => setTimeout(r, 1500));
	for (const [n, f] of [["a", a], ["b", b], ["c", c], ["d", d]]) {
		out[n] = { allow: f.allow, attr: f.getAttribute("allow"), afs: f.allowFullscreen, afsAttr: f.getAttribute("allowfullscreen"),
			html: f.outerHTML.replace(/:\\d+/g, ":P"), fpAllowed: f.featurePolicy ? f.featurePolicy.allowedFeatures().filter(x => ["camera","fullscreen","autoplay","clipboard-write","payment","geolocation"].includes(x)).sort() : null };
	}
	// innerHTML path
	const div = document.createElement("div"); div.innerHTML = '<iframe allow="autoplay; encrypted-media" allowfullscreen src="/f5.html"></iframe>'; document.body.append(div);
	await new Promise(r => setTimeout(r, 800));
	out.e = { allow: div.firstChild.allow, afs: div.firstChild.allowFullscreen, html: div.innerHTML };
	out.msgs = msgs;
	assertConsistent("perm", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-perm-iframe-allow",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
			"/f1.html": {
				body: frameJs,
			},
			"/f2.html": {
				body: frameJs,
			},
			"/f3.html": {
				body: frameJs,
			},
			"/f4.html": {
				body: frameJs,
			},
			"/f5.html": {
				body: frameJs,
			},
		},
	}),
];

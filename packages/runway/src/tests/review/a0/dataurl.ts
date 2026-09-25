import { playwrightTest, htmlTest } from "../../../testcommon.ts";

const GIF =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
export default [
	htmlTest({
		name: "rv0-dataurl-sinks",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preload" as="image" href="${GIF}">
<link rel="stylesheet" href="data:text/css,.pre{background:url(${GIF})}">
<style>.s{background:url(${GIF})} .t{background-image:image-set("${GIF}" 1x)}</style>
</head><body>
<img id="i1" src="${GIF}" srcset="${GIF} 1x, ${GIF} 2x">
<picture><source srcset="${GIF}"><img id="i2" src="${GIF}"></picture>
<div class="s pre t" style="background:url('${GIF}')">x</div>
<iframe src="data:text/html,<p>hi</p>"></iframe>
<script>
runTest(async () => {
	const out = {};
	const load = (el) => new Promise((r) => { el.onload = () => r("load"); el.onerror = () => r("error"); setTimeout(() => r("timeout"), 4000); });
	const im = new Image(); im.src = "${GIF}"; out.newImage = await load(im);
	const s = document.createElement("script"); s.src = "data:text/javascript,window.__d=1"; document.head.append(s); out.script = await load(s);
	out.fetch = await fetch("${GIF}").then((r) => r.status, (e) => "err " + e);
	out.xhr = await new Promise((r) => { const x = new XMLHttpRequest(); x.open("GET", "${GIF}"); x.onload = () => r(x.status); x.onerror = () => r("error"); x.send(); });
	const d = document.createElement("div"); d.style.backgroundImage = "url(${GIF})"; document.body.append(d);
	const d2 = document.createElement("div"); d2.innerHTML = '<img src="${GIF}"><img srcset="${GIF} 1x">'; document.body.append(d2);
	const w = new Worker("data:text/javascript,postMessage(1)"); out.worker = await new Promise((r) => { w.onmessage = () => r("msg"); w.onerror = () => r("error"); setTimeout(() => r("timeout"), 4000); });
	await new Promise((r) => setTimeout(r, 1500));
	fail("DATAURL " + JSON.stringify(out));
}, false);
</script></body></html>`,
	}),
];

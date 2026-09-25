import { htmlTest } from "../../../testcommon.ts";

export default [
	htmlTest({
		name: "rv0-cssattr-selectors",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
a[href="/exact"] { color: rgb(255, 0, 0); }
a[href^="/pre"] { color: rgb(0, 128, 0); }
a[href$=".pdf"] { color: rgb(0, 0, 255); }
a[href*="mid"] { color: rgb(255, 165, 0); }
a[href^="http"]:not([href*="localhost"]) { color: rgb(128, 0, 128); }
img[src$="logo.png"] { width: 7px; }
[style*="url("] { outline: 3px solid rgb(1, 2, 3); }
</style></head><body>
<a id="a1" href="/exact">1</a><a id="a2" href="/prefix/x">2</a><a id="a3" href="/doc.pdf">3</a><a id="a4" href="/a/mid/b">4</a><a id="a5" href="https://external.example/">5</a>
<img id="i1" src="/logo.png"><div id="d1" style="background:url(/bg.png)">d</div>
<script>
runTest(async () => {
	const c = (id) => getComputedStyle(document.getElementById(id)).color;
	const out = { a1: c("a1"), a2: c("a2"), a3: c("a3"), a4: c("a4"), a5: c("a5"), i1: getComputedStyle(document.getElementById("i1")).width, d1: getComputedStyle(document.getElementById("d1")).outlineColor };
	// and dynamically-set values
	const a6 = document.createElement("a"); a6.href = "/exact"; a6.id = "a6"; document.body.append(a6);
	const a7 = document.createElement("a"); a7.setAttribute("href", "/doc.pdf"); a7.id = "a7"; document.body.append(a7);
	out.a6 = c("a6"); out.a7 = c("a7");
	assertConsistent("css-attr-selectors", out);
}, true);
</script></body></html>`,
	}),
];

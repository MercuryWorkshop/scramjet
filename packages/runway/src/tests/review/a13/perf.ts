import { htmlTest } from "../../../testcommon.ts";

// Cost of the NamedNodeMap wrapper for index-based attribute walks (the
// AngularJS/Knockout/Vue in-DOM compiler pattern) and a few related reads.
// Always "fails" (assertConsistent of timings); read the numbers.

export default [
	htmlTest({
		name: "rv13-perf-attributes-walk",
		html: `<!doctype html><body><div id=root></div><script>
runTest(async () => {
	const root = document.getElementById("root");
	let html = "";
	for (let i = 0; i < 2000; i++) html += '<div class="row" id="r' + i + '" data-a="1" data-b="2" ng-click="go(' + i + ')" title="t"><a href="/item/' + i + '" target="_blank" style="color: red">x</a><img src="/i/' + i + '.png" alt=""></div>';
	root.innerHTML = html;
	const els = Array.from(root.getElementsByTagName("*"));
	const time = (f) => { const t0 = performance.now(); try { f(); } catch (e) { return "ERR " + e.message; } return +(performance.now() - t0).toFixed(1); };
	const out = {};
	out.indexWalk = time(() => { let n = 0; for (const el of els) { const at = el.attributes; for (let j = 0, jj = at.length; j < jj; j++) { const a = at[j]; n += a.name.length + a.value.length; } } return n; });
	out.itemWalk = time(() => { let n = 0; for (const el of els) { const at = el.attributes; for (let j = 0; j < at.length; j++) n += at.item(j).value.length; } return n; });
	out.iterWalk = time(() => { let n = 0; for (const el of els) for (const a of el.attributes) n += a.value.length; return n; });
	out.getNamedItem = time(() => { let n = 0; for (const el of els) { const a = el.attributes.getNamedItem("href") || el.attributes.getNamedItem("id"); if (a) n += a.value.length; } return n; });
	out.named = time(() => { let n = 0; for (const el of els) { const a = el.attributes.id; if (a) n += a.value.length; } return n; });
	out.getAttributeAll = time(() => { let n = 0; for (const el of els) for (const k of el.getAttributeNames()) n += (el.getAttribute(k) || "").length; return n; });
	out.qsaHref = time(() => { for (let k = 0; k < 20; k++) root.querySelectorAll('a[href^="/item/1"]'); });
	out.hrefGet = time(() => { let n = 0; for (const a of root.getElementsByTagName("a")) n += a.href.length; return n; });
	out.els = els.length;
	assertConsistent("timings", JSON.stringify(out));
}, true);
</script></body>`,
	}),
];

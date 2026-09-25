import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv3-perf-markup",
		scramjetOnly: true,
		js: `
let h = ""; for (let i = 0; i < 20000; i++) h += '<li class="i' + i + '" data-x="' + i + '"><a href="/p/' + i + '?a=1&amp;b=2" style="color:red">item &amp; ' + i + '</a><img src="/i/' + i + '.png"></li>';
h = "<ul>" + h + "</ul>";
const d = document.createElement("div");
const t0 = performance.now(); d.innerHTML = h; const t1 = performance.now();
const s = d.innerHTML; const t2 = performance.now();
let small = 0; const t3 = performance.now(); for (let i = 0; i < 3000; i++) { const e = document.createElement("div"); e.innerHTML = '<span class="a"><b>x</b> <a href="/y">y</a></span>'; small += e.innerHTML.length; } const t4 = performance.now();
const doc = new DOMParser().parseFromString("<!doctype html><body>" + h, "text/html"); const t5 = performance.now();
fail("PERF set=" + (t1 - t0).toFixed(0) + "ms get=" + (t2 - t1).toFixed(0) + "ms small3000=" + (t4 - t3).toFixed(0) + "ms domparser=" + (t5 - t4).toFixed(0) + "ms len=" + h.length);
`,
	}),
];

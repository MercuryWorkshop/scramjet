import { basicTest } from "../../../testcommon.ts";

const cases = [
	"<script>this is not js {</script><p>after</p>",
	"<script type=module>import x from; export {</script>",
	"<div onclick='{{ broken'>x</div>",
	"<div onclick='return false'>x</div>",
	"<img src=x onerror='alert(1)'><p>ok</p>",
	'<style>@import url("</style>',
	"<a href='http://[::1'>bad url</a>",
	"<a href='\u0000\u0001'>ctl</a>",
	"<img srcset=',,,, ,'>",
	"<img srcset='data:image/png;base64,AAA=, x.png 2x'>",
	"<iframe srcdoc='<script>{</script>'></iframe>",
	"<meta http-equiv=refresh content='url='>",
	"<svg><script>{{</script></svg>",
	"<math><mtext><script>{</script></mtext></math>",
	"<form action='javascript:void(0)'></form>",
	"<base href='::::'>",
	"<table><script>{</script></table>",
	"<template><script>{</script></template>",
	"<script>" + "a".repeat(10) + "</script",
	"<!--<script>-->",
	"<div style='background:url(\"'>x</div>",
	"<a href=" + "x".repeat(20000) + ">long</a>",
];

export default [
	basicTest({
		name: "rv2-markup-nothrow",
		js: `
			const cases = ${JSON.stringify(cases)};
			const res = [];
			for (const [i, h] of cases.entries()) {
				for (const api of ["innerHTML", "iah", "outer", "range", "dp", "unsafe"]) {
					let r;
					try {
						const host = document.createElement("div");
						const d = document.createElement("div");
						host.appendChild(d);
						if (api === "innerHTML") d.innerHTML = h;
						if (api === "iah") d.insertAdjacentHTML("beforeend", h);
						if (api === "outer") d.outerHTML = h;
						if (api === "range") { const rg = document.createRange(); rg.selectNodeContents(host); host.appendChild(rg.createContextualFragment(h)); }
						if (api === "dp") new DOMParser().parseFromString(h, "text/html");
						if (api === "unsafe") d.setHTMLUnsafe(h);
						r = "ok";
					} catch (e) { r = "THREW " + e.name + ": " + e.message.slice(0, 100); }
					assertConsistent(i + " " + api, r);
				}
			}
		`,
	}),
];

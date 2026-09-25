import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv9-probe-tt-meta",
		scramjetOnly: true,
		js: `
		const seen = [];
		trustedTypes.createPolicy("default", { createHTML: (s) => { seen.push(s); return s.replace(/scramjet-attr-[a-z-]+="[^"]*"/g, ""); }, createScript: s => s, createScriptURL: s => s });
		const m = document.createElement("meta");
		m.setAttribute("http-equiv", "Content-Security-Policy");
		m.setAttribute("content", "require-trusted-types-for 'script'");
		document.head.appendChild(m);
		const d = document.createElement("div");
		d.innerHTML = '<div style="width:5px" id="k"><img src="/a.png"></div>';
		const img = d.querySelector("img");
		console.log("RV9TT " + JSON.stringify({ seen, style: d.firstChild.getAttribute("style"), imgSrc: img.src, imgAttr: img.getAttribute("src"), cssw: d.firstChild.style.width }));
		assertEqual(seen.length, 0, "page TT default policy saw scramjet-internal HTML: " + JSON.stringify(seen));
		`,
	}),
];

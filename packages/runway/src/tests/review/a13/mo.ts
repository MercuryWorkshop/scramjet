import { htmlTest } from "../../../testcommon.ts";

// MutationObserver / attributeChangedCallback view of one write per rule cell:
// record names and old values, with and without attributeFilter.

const CELLS: [string, string, string, string, string?][] = [
	["img", "src", "/a.png", "/b.png"],
	["a", "href", "/a", "/b"],
	["a", "target", "_top", "_blank"],
	["meta", "content", "one", "two"],
	["div", "style", "color: red", "color: blue"],
	["div", "nonce", "n1", "n2"],
	["iframe", "sandbox", "allow-forms", "allow-popups"],
	["div", "onclick", "a()", "b()"],
	["script", "integrity", "sha256-a", "sha256-b"],
	["use", "href", "#a", "#b", "svg"],
	["use", "xlink:href", "#a", "#b", "svg"],
	["linearGradient", "href", "#a", "#b", "svg"],
	["div", "title", "a", "b"],
];

export default [
	htmlTest({
		name: "rv13-mo-records",
		html: `<!doctype html><body><div id=host></div><script>
runTest(async () => {
	const CELLS = ${JSON.stringify(CELLS)};
	const XL = "http://www.w3.org/1999/xlink", SVG = "http://www.w3.org/2000/svg";
	const host = document.getElementById("host");
	for (const [tag, n, a, b, ns] of CELLS) {
		const el = ns ? document.createElementNS(SVG, tag) : document.createElement(tag);
		if (tag === "script") el.type = "text/x-none";
		const set = (v) => n === "xlink:href" ? el.setAttributeNS(XL, n, v) : el.setAttribute(n, v);
		set(a); host.append(el);
		const all = [], filt = [];
		const m1 = new MutationObserver((rs) => rs.forEach((r) => all.push(r.attributeName + ":" + r.oldValue)));
		const m2 = new MutationObserver((rs) => rs.forEach((r) => filt.push(r.attributeName + ":" + r.oldValue)));
		m1.observe(el, { attributes: true, attributeOldValue: true });
		m2.observe(el, { attributes: true, attributeOldValue: true, attributeFilter: [n.replace("xlink:", "")] });
		set(b);
		el.removeAttribute(n);
		await new Promise((r) => setTimeout(r, 0));
		m1.disconnect(); m2.disconnect();
		assertConsistent(tag + "." + n + " all", all.join(" , "));
		assertConsistent(tag + "." + n + " filtered", filt.join(" , "));
	}
}, true);
</script></body>`,
	}),
];

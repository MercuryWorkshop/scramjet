import { htmlTest } from "../../../testcommon.ts";

export default [
	htmlTest({
		name: "rv2-perfreact-rows",
		scramjetOnly: false,
		html: `<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
</head><body><div id=root></div><script>
runTest(async () => {
	const e = React.createElement;
	const Row = ({ i, sel }) => e("tr", { className: sel ? "danger" : "" }, e("td", { className: "col-md-1" }, i), e("td", { className: "col-md-4" }, e("a", { href: "#" + i }, "label " + i)), e("td", null, e("a", null, e("span", { className: "glyphicon", "aria-hidden": "true" }))));
	const App = ({ n, sel, v }) => e("table", null, e("tbody", null, Array.from({ length: n }, (_, i) => e(Row, { key: i, i: i + v, sel: i === sel }))));
	const root = ReactDOM.createRoot(document.getElementById("root"));
	const t = [];
	const stats = {};
	const wrapM = (proto, name, label) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (!d || !d.value) return; const f = d.value; proto[name] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { const st = stats[label] ||= [0, 0]; st[0]++; st[1] += performance.now() - t0; } }; };
	const wrapA = (proto, name, label) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (!d) return; const nd = { configurable: true, enumerable: d.enumerable }; if (d.get) nd.get = function () { const t0 = performance.now(); try { return d.get.call(this); } finally { const st = stats[label + " get"] ||= [0, 0]; st[0]++; st[1] += performance.now() - t0; } }; if (d.set) nd.set = function (v) { const t0 = performance.now(); try { return d.set.call(this, v); } finally { const st = stats[label + " set"] ||= [0, 0]; st[0]++; st[1] += performance.now() - t0; } }; Object.defineProperty(proto, name, nd); };
	{ const f = Element.prototype.setAttribute; Element.prototype.setAttribute = function (n, v) { const t0 = performance.now(); try { return f.call(this, n, v); } finally { const st = stats["setAttribute " + this.localName + "." + n] ||= [0, 0]; st[0]++; st[1] += performance.now() - t0; } }; }
	for (const n of ["appendChild", "insertBefore", "removeChild", "replaceChild"]) wrapM(Node.prototype, n, n);
	for (const n of ["textContent", "nodeValue", "nodeName", "nodeType", "firstChild", "lastChild", "parentNode", "ownerDocument"]) wrapA(Node.prototype, n, n);
	for (const n of ["className", "innerHTML", "tagName", "namespaceURI"]) wrapA(Element.prototype, n, n);
	wrapA(CharacterData.prototype, "data", "data");
	wrapA(HTMLAnchorElement.prototype, "href", "a.href");
	for (let k = 0; k < 3; k++) {
		let t0 = performance.now();
		ReactDOM.flushSync(() => root.render(e(App, { n: 2000, sel: -1, v: k * 10000 })));
		t.push("create " + (performance.now() - t0).toFixed(0));
		t0 = performance.now();
		ReactDOM.flushSync(() => root.render(e(App, { n: 2000, sel: 5, v: k * 10000 + 1 })));
		t.push("update " + (performance.now() - t0).toFixed(0));
		t0 = performance.now();
		ReactDOM.flushSync(() => root.render(e(App, { n: 0, sel: -1, v: 0 })));
		t.push("clear " + (performance.now() - t0).toFixed(0));
	}
	const top = Object.entries(stats).sort((a, b) => b[1][1] - a[1][1]).slice(0, 12).map(([k, v]) => k + ":" + v[0] + "/" + v[1].toFixed(0) + "ms");
	fail("TIMING react " + t.join(", ") + " STATS " + top.join(" "));
}, false);
</script></body></html>`,
	}),
];

import { serverTest } from "../../../testcommon.ts";

// everyday DOM operations, timed. The assertion only prints the numbers
export default [
	serverTest({
		name: "v3-perf-dom-ops",
		timeoutMs: 120000,
		start: async (server) => {
			server.on("request", (req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><div id=root></div><script>
runTest(async () => {
	const t = (fn) => { fn(); const s = performance.now(); fn(); return +(performance.now() - s).toFixed(1); };
	const N = 5000;
	const out = {};
	out.createAppend = t(() => { const f = document.createElement("div"); for (let i = 0; i < N; i++) { const d = document.createElement("div"); d.className = "c" + i; f.appendChild(d); } root.replaceChildren(f); });
	out.insertBefore = t(() => { for (let i = 0; i < N; i++) root.insertBefore(document.createElement("span"), root.firstChild); });
	out.removeChild = t(() => { while (root.firstChild) root.removeChild(root.firstChild); root.append(...Array.from({length: N}, () => document.createElement("i"))); });
	out.setAttrClass = t(() => { const d = document.createElement("div"); for (let i = 0; i < N; i++) d.setAttribute("class", "x" + i); });
	out.setAttrData = t(() => { const d = document.createElement("div"); for (let i = 0; i < N; i++) d.setAttribute("data-x", i); });
	out.setAttrHref = t(() => { const a = document.createElement("a"); for (let i = 0; i < N; i++) a.setAttribute("href", "/p/" + i); });
	out.getAttr = t(() => { const d = document.createElement("div"); d.setAttribute("data-k", "v"); let x; for (let i = 0; i < N * 4; i++) x = d.getAttribute("data-k"); });
	out.hrefRead = t(() => { const a = document.createElement("a"); a.href = "/x"; let x; for (let i = 0; i < N; i++) x = a.href; });
	out.imgSrcSet = t(() => { for (let i = 0; i < N / 5; i++) { const m = new Image(); m.src = "/img" + i + ".png"; } });
	out.classList = t(() => { const d = document.createElement("div"); for (let i = 0; i < N * 4; i++) d.classList.toggle("on"); });
	out.innerHTMLSet = t(() => { for (let i = 0; i < 200; i++) root.innerHTML = '<ul>' + '<li class="a"><a href="/x">x</a><img src="/y.png"></li>'.repeat(50) + '</ul>'; });
	out.innerHTMLGet = t(() => { let x; for (let i = 0; i < 200; i++) x = root.innerHTML; });
	out.textContentSet = t(() => { const d = document.createElement("p"); for (let i = 0; i < N * 2; i++) d.textContent = "t" + i; });
	out.querySelectorAll = t(() => { let x; for (let i = 0; i < 2000; i++) x = root.querySelectorAll("li a").length; });
	out.cloneNodeDeep = t(() => { let x; for (let i = 0; i < 200; i++) x = root.cloneNode(true); });
	out.addRemoveListener = t(() => { const d = document.createElement("div"); for (let i = 0; i < N; i++) { const f = () => {}; d.addEventListener("click", f); d.removeEventListener("click", f); } });
	out.dispatch = t(() => { const d = document.createElement("div"); d.addEventListener("x", () => {}); for (let i = 0; i < N; i++) d.dispatchEvent(new Event("x")); });
	out.mutationObserver = t(() => { const mo = new MutationObserver(() => {}); mo.observe(root, { childList: true, subtree: true, attributes: true }); for (let i = 0; i < N; i++) root.appendChild(document.createElement("b")).setAttribute("data-i", i); mo.takeRecords(); mo.disconnect(); });
	out.scriptInsert = t(() => { for (let i = 0; i < 200; i++) { const s = document.createElement("script"); s.textContent = "window.__z = " + i; document.head.appendChild(s); s.remove(); } });
	out.localStorage = t(() => { for (let i = 0; i < N; i++) { localStorage.setItem("k" + (i % 50), "v" + i); localStorage.getItem("k" + (i % 50)); } });
	out.documentCookie = t(() => { let x; for (let i = 0; i < 1000; i++) x = document.cookie; });
	out.fetchBlob = 0;
	assertConsistent("times", out);
}, true);
</script>`);
			});
		},
	}),
];

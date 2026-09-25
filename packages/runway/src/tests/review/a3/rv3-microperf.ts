import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv3-microperf",
		scramjetOnly: true,
		js: `
const N = 50000; const out = [];
const bench = (name, fn) => { fn(100); const t = performance.now(); fn(N); out.push(name + "=" + ((performance.now() - t) * 1000 / N).toFixed(2) + "us"); };
const d = document.createElement("div"); document.body.append(d); const tx = document.createTextNode("x"); d.append(tx);
const cm = document.createComment("c"); d.append(cm);
bench("text.data=", n => { for (let i = 0; i < n; i++) tx.data = "v" + i; });
bench("text.nodeValue=", n => { for (let i = 0; i < n; i++) tx.nodeValue = "v" + i; });
bench("el.textContent=", n => { for (let i = 0; i < n; i++) d.textContent = "v" + i; });
d.append(tx, cm);
bench("createTextNode+append+remove", n => { for (let i = 0; i < n; i++) { const t = document.createTextNode("a"); d.insertBefore(t, cm); t.remove(); } });
bench("insertBefore el", n => { for (let i = 0; i < n; i++) { const e = document.createElement("span"); d.insertBefore(e, cm); d.removeChild(e); } });
bench("setAttribute class", n => { for (let i = 0; i < n; i++) d.setAttribute("class", "c" + (i & 7)); });
bench("setAttribute href", n => { const a = document.createElement("a"); for (let i = 0; i < n; i++) a.setAttribute("href", "#/" + (i & 7)); });
bench("className=", n => { for (let i = 0; i < n; i++) d.className = "c" + (i & 7); });
bench("addEventListener+remove", n => { const f = () => {}; for (let i = 0; i < n; i++) { d.addEventListener("click", f); d.removeEventListener("click", f); } });
bench("querySelector .x", n => { for (let i = 0; i < n; i++) document.querySelector(".nope"); });
bench("querySelector [href]", n => { for (let i = 0; i < n; i++) document.querySelector('[href="#/x"]'); });
bench("firstChild/nextSibling", n => { for (let i = 0; i < n; i++) { let c = d.firstChild; while (c) c = c.nextSibling; } });
bench("template clone", n => { const t = document.createElement("template"); t.innerHTML = "<li><b>x</b><!--m--></li>"; for (let i = 0; i < Math.min(n, 20000); i++) d.append(t.content.cloneNode(true)); d.textContent = ""; });
bench("importNode", n => { const t = document.createElement("template"); t.innerHTML = "<li><b>x</b></li>"; for (let i = 0; i < Math.min(n, 20000); i++) document.importNode(t.content, true); });
bench("getAttribute", n => { for (let i = 0; i < n; i++) d.getAttribute("class"); });
bench("style.setProperty", n => { for (let i = 0; i < n; i++) d.style.setProperty("color", "red"); });
bench("dispatchEvent", n => { d.addEventListener("x", () => {}); const e = new Event("x"); for (let i = 0; i < n; i++) d.dispatchEvent(e); });
fail("MICRO " + out.join(" "));
`,
	}),
];

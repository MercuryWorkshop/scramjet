import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv9-probe-srcdoc-nested",
		scramjetOnly: true,
		js: `
		const res = {};
		const t = (k, f) => { try { f(); res[k] = "ok"; } catch (e) { res[k] = "THROW " + e.message; } };
		const outer = document.createElement("iframe"); document.body.appendChild(outer);
		const w = outer.contentWindow, d = outer.contentDocument;
		t("blank-child srcdoc", () => { const f = d.createElement("iframe"); f.srcdoc = "<p>x</p>"; d.body.appendChild(f); });
		t("blank-child srcdoc before append", () => { const f = d.createElement("iframe"); d.body.appendChild(f); f.srcdoc = "<a href='/x'>x</a>"; });
		t("detached srcdoc", () => { const f = document.createElement("iframe"); f.srcdoc = "<p>x</p>"; });
		const s = document.createElement("iframe"); s.srcdoc = "<body></body>"; document.body.appendChild(s);
		await new Promise(r => s.onload = r);
		const sd = s.contentDocument;
		t("srcdoc-child srcdoc", () => { const f = sd.createElement("iframe"); sd.body.appendChild(f); f.srcdoc = "<img src='/a.png'>"; });
		const pd = new DOMParser().parseFromString("<body>", "text/html");
		t("domparser srcdoc", () => { const f = pd.createElement("iframe"); f.srcdoc = "<p>x</p>"; });
		const hd = document.implementation.createHTMLDocument("");
		t("impl srcdoc", () => { const f = hd.createElement("iframe"); f.srcdoc = "<p>x</p>"; });
		t("impl setAttribute srcdoc", () => { const f = hd.createElement("iframe"); f.setAttribute("srcdoc", "<p>x</p>"); });
		t("blank setAttribute srcdoc", () => { const f = d.createElement("iframe"); f.setAttribute("srcdoc", "<p>x</p>"); });
		console.log("RV9SRCDOC " + JSON.stringify(res));
		const bad = Object.entries(res).filter(([k, v]) => v !== "ok");
		assert(bad.length === 0, JSON.stringify(bad));
		`,
	}),
];

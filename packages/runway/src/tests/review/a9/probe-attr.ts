import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv9-probe-attr-leak",
		scramjetOnly: true,
		js: `
		const res = {};
		const H = '<div style="width:1px" class="a"><svg viewBox="0 0 4 4"><path d="M0 0"></path></svg><img src="/x.png"></div>';
		const t = (k, f) => { try { const v = f(); res[k] = /scramjet/.test(v) ? "LEAK " + v.slice(0, 200) : "ok"; } catch (e) { res[k] = "THROW " + e; } };
		const d = document.createElement("div"); d.innerHTML = H;
		t("innerHTML", () => d.innerHTML);
		t("outerHTML", () => d.firstChild.outerHTML);
		t("getHTML", () => d.getHTML());
		t("XMLSerializer", () => new XMLSerializer().serializeToString(d));
		t("attrs", () => [...d.firstChild.attributes].map(a => a.name).join(","));
		t("getAttributeNames", () => d.firstChild.getAttributeNames().join(","));
		const tpl = document.createElement("template"); tpl.innerHTML = H;
		t("template.innerHTML", () => tpl.innerHTML);
		t("template.content", () => { const x = document.createElement("div"); x.appendChild(tpl.content.cloneNode(true)); return x.innerHTML; });
		const pd = new DOMParser().parseFromString("<body>" + H, "text/html");
		t("DOMParser body.innerHTML", () => pd.body.innerHTML);
		t("DOMParser attrs", () => [...pd.body.firstChild.attributes].map(a => a.name).join(","));
		const hd = document.implementation.createHTMLDocument("");
		hd.body.innerHTML = H;
		t("implDoc innerHTML", () => hd.body.innerHTML);
		t("implDoc XMLSerializer", () => new XMLSerializer().serializeToString(hd.body));
		const e2 = document.createElement("div"); e2.setAttribute("style", "color:red"); e2.style.width = "3px";
		t("setAttribute style outerHTML", () => e2.outerHTML);
		const r = document.createRange(); r.selectNode(document.body);
		const fr = r.createContextualFragment(H);
		t("contextualFragment", () => { const x = document.createElement("div"); x.appendChild(fr); return x.innerHTML; });
		const sr = document.createElement("div").attachShadow({mode:"open"}); sr.innerHTML = H;
		t("shadow innerHTML", () => sr.innerHTML);
		t("sanitizer-like clone", () => { const x = hd.createElement("div"); x.innerHTML = H; const y = hd.importNode(x, true); return y.outerHTML; });
		t("doc-owned via adopt", () => { const x = hd.createElement("div"); x.innerHTML = H; document.body.appendChild(x); return x.outerHTML; });
		t("style via cssText then outerHTML", () => { const x = document.createElement("div"); x.style.cssText = "width:2px"; return x.outerHTML; });
		console.log("RV9ATTR " + JSON.stringify(res));
		const leaks = Object.entries(res).filter(([k, v]) => v !== "ok");
		assert(leaks.length === 0, JSON.stringify(leaks));
		`,
	}),
];

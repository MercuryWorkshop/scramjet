import { basicTest } from "../../../testcommon.ts";
/* eslint-disable quotes */

export default [
	basicTest({
		name: "rv22-docprops",
		js: `
			const O = location.origin;
			const norm = (v) => typeof v === "string" ? v.split(O).join("O").replace(/localhost:\\d+/g, "HOST") : v;
			const out = {};
			const t = (k, f) => { try { out[k] = norm(f()); } catch (e) { out[k] = "THROW " + e.name; } };
			const props = (p, d) => { t(p + "URL", () => d.URL); t(p + "documentURI", () => d.documentURI); t(p + "baseURI", () => d.baseURI); t(p + "domain", () => d.domain); t(p + "referrer", () => d.referrer); };
			props("top.", document);
			history.pushState(null, "", "/pushed/deep?x=1#h");
			props("pushed.", document);
			t("set-domain-same", () => { document.domain = document.domain; return document.domain; });
			t("set-domain-upper", () => { document.domain = document.domain.toUpperCase(); return document.domain; });
			t("set-domain-bad", () => { document.domain = "example.com"; return document.domain; });
			t("set-domain-empty", () => { document.domain = ""; return document.domain; });
			const f1 = document.createElement("iframe"); document.body.appendChild(f1);
			props("blank.", f1.contentDocument);
			t("blank-set-domain", () => { f1.contentDocument.domain = f1.contentDocument.domain; return f1.contentDocument.domain; });
			const f2 = document.createElement("iframe"); f2.srcdoc = "<p>x</p>"; document.body.appendChild(f2);
			await new Promise(r => f2.onload = r);
			props("srcdoc.", f2.contentDocument);
			const f3 = document.createElement("iframe"); f3.src = "/nope404?y=2"; document.body.appendChild(f3);
			await new Promise(r => f3.onload = r);
			props("sub.", f3.contentDocument);
			t("sub.frameElement", () => f3.contentWindow.frameElement === f3);
			const d = new DOMParser().parseFromString("<p>", "text/html");
			props("parsed.", d);
			const d2 = document.implementation.createHTMLDocument("x");
			props("impl.", d2);
			const x = await new Promise((res) => { const r = new XMLHttpRequest(); r.open("GET", "/nope404"); r.responseType = "document"; r.onload = () => res(r.responseXML); r.onerror = () => res(null); r.send(); });
			if (x) props("xhrdoc.", x);
			for (const k in out) assertConsistent(k, out[k]);
		`,
	}),
];

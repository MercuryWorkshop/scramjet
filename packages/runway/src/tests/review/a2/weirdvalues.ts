import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-weird-values",
		js: `
			const vals = ["", " ", "http://[bad", "//", "\\\\\\\\host\\\\share", "javascript:", "javascript:void(0)", "data:", "blob:", "blob:nope", "about:", "#", "?", "%", "%zz", "http://a b/", "\\u0000", "x".repeat(5000), "chrome://settings", "file:///etc/passwd", "ws://x/", "mailto:", "http://user:pass@h.test/", "HTTP://UPPER.TEST/A", "  http://x.test/  ", "\\n/x\\n", "\\ud800", "https://xn--nxasmq6b.test/", "https://例え.テスト/パス", "http://127.0.0.1:99999/", "urn:isbn:1", "tel:1", "sms:1", "intent://x#Intent;end", "view-source:http://x", "/a/../b/./c", "../../up", "https://x.test/?q=%E2%9C%93&a=1#h"];
			const combos = [["img","src"],["iframe","src"],["script","src"],["link","href"],["a","href"],["area","href"],["form","action"],["video","src"],["video","poster"],["audio","src"],["source","src"],["object","data"],["embed","src"],["input","src"],["input","formaction"],["button","formaction"],["img","srcset"],["source","srcset"],["link","imagesrcset"],["iframe","srcdoc"],["div","style"],["a","target"],["base","href"],["track","src"],["frame","src"]];
			const out = {};
			for (const [tag, attr] of combos) {
				for (const v of vals) {
					const k = tag + "[" + attr + "]=" + JSON.stringify(v).slice(0, 40);
					try {
						const el = document.createElement(tag);
						el.setAttribute(attr, v);
						const back = el.getAttribute(attr);
						out[k] = back === v ? "same" : "DIFF:" + JSON.stringify(back).slice(0, 80);
					} catch (e) { out[k] = "THREW " + e.name + ": " + e.message.slice(0, 80); }
				}
			}
			const NS = "http://www.w3.org/2000/svg";
			for (const v of vals) {
				const k = "svguse=" + JSON.stringify(v).slice(0, 40);
				try { const u = document.createElementNS(NS, "use"); u.setAttribute("href", v); u.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", v); out[k] = [u.getAttribute("href") === v, u.getAttributeNS("http://www.w3.org/1999/xlink", "href") === v, u.href.baseVal === v].join(","); } catch (e) { out[k] = "THREW " + e.message.slice(0, 80); }
				const k2 = "meta=" + JSON.stringify(v).slice(0, 40);
				try { const m = document.createElement("meta"); m.setAttribute("http-equiv", "refresh"); m.setAttribute("content", "0; url=" + v); out[k2] = m.getAttribute("content") === "0; url=" + v; } catch (e) { out[k2] = "THREW " + e.message.slice(0, 80); }
			}
			const bad = Object.entries(out).filter(([k, v]) => v !== "same" && v !== true && v !== "true,true,true");
			assertConsistent("bad", JSON.stringify(bad));
		`,
	}),
];

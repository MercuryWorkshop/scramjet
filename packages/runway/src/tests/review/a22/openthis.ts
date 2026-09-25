import { basicTest } from "../../../testcommon.ts";
/* eslint-disable quotes */

// window.open / frameElement reached without a window receiver
export default [
	basicTest({
		name: "rv22-open-receivers",
		js: `
			const f = document.createElement("iframe"); f.name = "rv22fr"; document.body.appendChild(f);
			await new Promise(r => setTimeout(r, 100));
			const out = {};
			const t = (k, fn) => { try { const w = fn(); out[k] = w === f.contentWindow ? "iframe" : String(w); } catch (e) { out[k] = "THROW " + e.name + ": " + e.message; } };
			t("method", () => window.open("about:blank#1", "rv22fr"));
			t("bare-call", () => open("about:blank#2", "rv22fr"));
			t("detached", () => { const o = window.open; return o("about:blank#3", "rv22fr"); });
			t("comma", () => (0, window.open)("about:blank#4", "rv22fr"));
			t("call-undef", () => window.open.call(undefined, "about:blank#5", "rv22fr"));
			t("call-null", () => window.open.call(null, "about:blank#5b", "rv22fr"));
			t("strict", () => (function () { "use strict"; const o = window.open; return o("about:blank#6", "rv22fr"); })());
			t("bind", () => window.open.bind(window)("about:blank#7", "rv22fr"));
			t("apply-self", () => Reflect.apply(open, self, ["about:blank#8", "rv22fr"]));
			const fe = Object.getOwnPropertyDescriptor(window, "frameElement").get;
			t("fe-undef", () => String(fe.call(undefined)));
			t("fe-bare", () => String(frameElement));
			t("iframe-fe", () => f.contentWindow.frameElement === f ? "same" : String(f.contentWindow.frameElement));
			t("open-rel", () => { const w = window.open("/rv22-target?a=1", "rv22fr"); return w === f.contentWindow ? "iframe" : "other"; });
			await new Promise(r => setTimeout(r, 600));
			out.iframeLoc = (() => { try { return f.contentWindow.location.pathname + f.contentWindow.location.search; } catch (e) { return "THROW " + e.message; } })();
			for (const k in out) assertConsistent(k, out[k]);
			console.log("RV22OPEN " + JSON.stringify(out));
		`,
	}),
];

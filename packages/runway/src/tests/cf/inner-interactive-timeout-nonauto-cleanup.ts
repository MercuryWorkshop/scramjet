import { basicTest } from "../../testcommon.ts";

// Exact non-auto cleanup branch from data4/inner.js_translated.js:3279-3283:
//
//   !YFNJ6 && (_cf_chl_opt.YyXhA9 = 1, parent.postMessage({ source:
//     "cloudflare-challenge", widgetId: _cf_chl_opt.xpbnF3, event:
//     "interactiveTimeout" }, "*"), _cf_chl_opt.LLKqf9 !== "auto" &&
//     (oIvGL6.UFBd8(), oIvGL6.xlbh6(), oIvGL6.gbKD2(), oIvGL6.XkWA7(),
//      F(), oIvGL6.clMBp4()))

export default basicTest({
	name: "cf-inner-interactive-timeout-nonauto-cleanup",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-interactive-timeout-nonauto";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, LLKqf9: "never" };
      child.eval(` +
		"`" +
		`
        window.calls = [];
        window.YFNJ6 = false;
        window.oIvGL6 = {
          UFBd8() { window.calls.push("UFBd8"); },
          xlbh6() { window.calls.push("xlbh6"); },
          gbKD2() { window.calls.push("gbKD2"); },
          XkWA7() { window.calls.push("XkWA7"); },
          clMBp4() { window.calls.push("clMBp4"); },
        };
        window.F = () => {
          window.calls.push("F");
          window.oIvGL6.YBmkB4 = true;
        };
        window.__interactiveTimeout = () => {
          if (!window.YFNJ6) {
            window._cf_chl_opt.YyXhA9 = 1;
            window.parent.postMessage({
              source: "cloudflare-challenge",
              widgetId: window._cf_chl_opt.xpbnF3,
              event: "interactiveTimeout",
            }, "*");

            if (window._cf_chl_opt.LLKqf9 !== "auto") {
              window.oIvGL6.UFBd8();
              window.oIvGL6.xlbh6();
              window.oIvGL6.gbKD2();
              window.oIvGL6.XkWA7();
              window.F();
              window.oIvGL6.clMBp4();
            }
          }
        };
      ` +
		"`" +
		`);

      const resultPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("interactiveTimeout non-auto timed out")), 3000);
        const listener = (event) => {
          const data = event.data || {};
          if (data.widgetId === widgetId && data.event === "interactiveTimeout") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              data,
              optFlag: child._cf_chl_opt.YyXhA9,
              frozenFlag: child.oIvGL6.YBmkB4,
              calls: child.calls.slice(),
            });
          }
        };
        window.addEventListener("message", listener);
      });

      child.__interactiveTimeout();
      const result = await resultPromise;

      assert(result.data.source === "cloudflare-challenge", "interactive source mismatch");
      assert(result.optFlag === 1, "interactive timeout should set YyXhA9");
      assert(result.frozenFlag === true, "F should set the frozen flag");
      assert(result.calls.join(",") === "UFBd8,xlbh6,gbKD2,XkWA7,F,clMBp4", "non-auto cleanup order mismatch");
      assertConsistent("inner-interactive-timeout-nonauto-cleanup", result);
    } finally {
      iframe.remove();
    }
  `,
});

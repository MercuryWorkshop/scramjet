import { basicTest } from "../../testcommon.ts";

// Message filter and idempotence from inner.js_translated.js:5809-5810 and 5848-5851:
//   if (data.source !== "cloudflare-challenge" || widgetId mismatch) return;
//   event === "forceFail" only calls gbKD2/XkWA7/afLAi7 while !YFNJ6, then sets YFNJ6.

export default basicTest({
	name: "cf-inner-forcefail-idempotent-filters",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-forcefail-filter";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        window.calls = [];
        window.oIvGL6 = {
          gbKD2() { window.calls.push('gbKD2'); },
          XkWA7() { window.calls.push('XkWA7'); },
          afLAi7() { window.calls.push('afLAi7'); }
        };
        var W = {
          OMaTR: function(a, b) { return a !== b; },
          KXMFk: function(a, b) { return a === b; },
          fCQiB: 'forceFail'
        };
        window.addEventListener('message', function(qg) {
          var qq = qg.data;
          if (qq.source !== 'cloudflare-challenge' || W.OMaTR(qq.widgetId, window._cf_chl_opt.xpbnF3)) return;
          if (qq.event === 'execute') return;
          W.KXMFk(qq.event, W.fCQiB) ? !window.YFNJ6 && (window.oIvGL6.gbKD2(), window.oIvGL6.XkWA7(), window.oIvGL6.afLAi7(), window.YFNJ6 = true) : null;
        });
      \`);

      child.postMessage({ source: "not-cloudflare", widgetId, event: "forceFail" }, "*");
      child.postMessage({ source: "cloudflare-challenge", widgetId: "wrong-widget", event: "forceFail" }, "*");
      child.postMessage({ source: "cloudflare-challenge", widgetId, event: "execute" }, "*");
      child.postMessage({ source: "cloudflare-challenge", widgetId, event: "forceFail" }, "*");
      child.postMessage({ source: "cloudflare-challenge", widgetId, event: "forceFail" }, "*");

      const result = await new Promise((resolve) => setTimeout(() => resolve({
        calls: child.calls.slice(),
        YFNJ6: child.YFNJ6,
      }), 250));

      assert(result.calls.join(",") === "gbKD2,XkWA7,afLAi7", "forceFail should run once after filters");
      assert(result.YFNJ6 === true, "forceFail should set YFNJ6");
      assertConsistent("inner-forcefail-idempotent-filters", result);
    } finally {
      iframe.remove();
    }
  `,
});

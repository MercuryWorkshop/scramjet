import { basicTest } from "../../testcommon.ts";

// Exact forceFail message branch from inner.js_translated.js:5807-5810 and 5848-5851:
//   after source/widgetId filtering, event === W.fCQiB calls gbKD2, XkWA7,
//   afLAi7 in order and sets YFNJ6 = true, but only if it was not already set.

export default basicTest({
	name: "cf-inner-forcefail-message-side-effects",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-forcefail";

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

      child.postMessage({ source: "cloudflare-challenge", widgetId, event: "forceFail" }, "*");
      const result = await new Promise((resolve) => setTimeout(() => resolve({
        calls: child.calls.slice(),
        YFNJ6: child.YFNJ6,
      }), 250));

      assert(result.calls.join(",") === "gbKD2,XkWA7,afLAi7", "forceFail call order mismatch");
      assert(result.YFNJ6 === true, "forceFail YFNJ6 side effect mismatch");
      assertConsistent("inner-forcefail-message-side-effects", result);
    } finally {
      iframe.remove();
    }
  `,
});

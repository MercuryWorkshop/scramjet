import { basicTest } from "../../testcommon.ts";

// The shared message filter before requestTurnstileResults from inner.js_translated.js:5809-5810 and 5851-5861:
//   wrong source or widgetId returns before the turnstileResults response is posted.

export default basicTest({
	name: "cf-inner-request-turnstile-results-filters",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-results-filter",
      puyP7: "ray-filter",
      Lgky2: "rcv-filter",
      IThaC9: "sitekey-filter",
      EEArb6: "managed",
      yiuuz4: "md-filter",
      qxzT2: "frmd-filter",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(\`
        var W = {
          eFfDO: 'cloudflare-challenge',
          ZLRxH: 'turnstileResults',
          OMaTR: function(a, b) { return a !== b; },
          KXMFk: function(a, b) { return a === b; }
        };
        window.addEventListener('message', function(qg) {
          var qq = qg.data;
          if (qq.source !== 'cloudflare-challenge' || W.OMaTR(qq.widgetId, window._cf_chl_opt.xpbnF3)) return;
          if (W.KXMFk(qq.event, 'requestTurnstileResults')) {
            window.parent.postMessage({
              source: W.eFfDO,
              widgetId: window._cf_chl_opt.xpbnF3,
              event: W.ZLRxH,
              rayId: window._cf_chl_opt.puyP7,
              rcV: window._cf_chl_opt.Lgky2,
              sitekey: window._cf_chl_opt.IThaC9,
              mode: window._cf_chl_opt.EEArb6,
              md: window._cf_chl_opt.yiuuz4,
              frMd: window._cf_chl_opt.qxzT2
            }, '*');
          }
        });
      \`);

      const result = await new Promise((resolve) => {
        const messages = [];
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "turnstileResults") messages.push(event.data);
        };
        window.addEventListener("message", listener);
        child.postMessage({ source: "not-cloudflare", widgetId: opts.xpbnF3, event: "requestTurnstileResults" }, "*");
        child.postMessage({ source: "cloudflare-challenge", widgetId: "wrong-widget", event: "requestTurnstileResults" }, "*");
        child.postMessage({ source: "cloudflare-challenge", widgetId: opts.xpbnF3, event: "requestTurnstileResults" }, "*");
        setTimeout(() => {
          window.removeEventListener("message", listener);
          resolve({ messages });
        }, 250);
      });

      assert(result.messages.length === 1, "only valid requestTurnstileResults should receive a response");
      assert(result.messages[0].widgetId === opts.xpbnF3, "filtered result widgetId mismatch");
      assert(result.messages[0].rayId === opts.puyP7, "filtered result rayId mismatch");
      assert(result.messages[0].frMd === opts.qxzT2, "filtered result frMd mismatch");
      assertConsistent("inner-request-turnstile-results-filters", result);
    } finally {
      iframe.remove();
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact requestTurnstileResults response from inner.js_translated.js:5848-5861:
//
//   on message event "requestTurnstileResults", parent.postMessage({
//     source, widgetId, event, rayId, rcV, sitekey, mode, md, frMd
//   }, "*")

export default basicTest({
	name: "cf-inner-request-turnstile-results-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-results",
      puyP7: "ray-runway",
      Lgky2: "rcv-runway-results",
      IThaC9: "sitekey-runway",
      EEArb6: "managed",
      yiuuz4: "md-runway",
      qxzT2: "frmd-runway-results",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(` +
		"`" +
		`
        var W = {
          eFfDO: 'cloudflare-challenge',
          ZLRxH: 'turnstileResults',
          KXMFk: function(a, b) { return a === b; }
        };
        window.addEventListener('message', function(qg) {
          var qq = qg.data;
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
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("turnstileResults timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "turnstileResults") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
        child.postMessage({ event: "requestTurnstileResults" }, "*");
      });

      assert(result.data.source === "cloudflare-challenge", "results source mismatch");
      assert(result.data.widgetId === opts.xpbnF3, "results widgetId mismatch");
      assert(result.data.event === "turnstileResults", "results event mismatch");
      assert(result.data.rayId === opts.puyP7, "results rayId mismatch");
      assert(result.data.rcV === opts.Lgky2, "results rcV mismatch");
      assert(result.data.sitekey === opts.IThaC9, "results sitekey mismatch");
      assert(result.data.mode === opts.EEArb6, "results mode mismatch");
      assert(result.data.md === opts.yiuuz4, "results md mismatch");
      assert(result.data.frMd === opts.qxzT2, "results frMd mismatch");
      assertConsistent("inner-request-turnstile-results-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact testing-only fail branch from inner.js_translated.js:4000-4015:
//   when IThaC9 is 2x...AB/BB, set YFNJ6 and post fail with rcV/cfChlOut/
//   cfChlOutS/code/frMd from _cf_chl_opt and literal code "600010".

export default basicTest({
	name: "cf-inner-testing-only-fail-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-testing-fail";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = {
        xpbnF3: widgetId,
        IThaC9: "2x00000000000000000000AB",
        Lgky2: "rcv-runway",
        VNUtN0: "cf-chl-out-runway",
        IWdn9: "cf-chl-out-s-runway",
        qxzT2: "fr-md-runway",
      };
      child.eval(\`
        window.oIvGL6 = { iLIV6() {}, sbHe4() {}, XkWA7() {}, afLAi7() {} };
        window.nJWjq3 = function() {};
        function s(value) { return value; }

        var q = {
          jzRNO: '600010',
          luQPx: function(Z, E) { return E === Z; },
          BPVuv: '2x00000000000000000000BB'
        };
        function T() { setInterval(window.oIvGL6.iLIV6, 1000); }

        if (window._cf_chl_opt.IThaC9 === '2x00000000000000000000AB' || q.luQPx(window._cf_chl_opt.IThaC9, q.BPVuv)) {
          window.nJWjq3('31wBKUAIgY2VQv+OvRR9HRg7pS9xL3wwoJQoBGJ6SaQ=$B/cgiu8IgDfWggicgmrp5Q==');
          T();
          window.oIvGL6.sbHe4(s('testing_only'));
          setTimeout(function() {
            window.oIvGL6.XkWA7();
            window.oIvGL6.afLAi7();
            window.YFNJ6 = true;
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              rcV: window._cf_chl_opt.Lgky2,
              event: 'fail',
              cfChlOut: window._cf_chl_opt.VNUtN0,
              cfChlOutS: window._cf_chl_opt.IWdn9,
              code: q.jzRNO,
              frMd: window._cf_chl_opt.qxzT2
            }, '*');
          }, 0);
        }
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("testing-only fail message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "fail") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data, childYFNJ6: child.YFNJ6 });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.code === "600010", "testing-only fail code mismatch");
      assert(result.data.cfChlOut === "cf-chl-out-runway", "testing-only cfChlOut mismatch");
      assert(result.childYFNJ6 === true, "testing-only YFNJ6 side effect mismatch");
      assertConsistent("inner-testing-only-fail-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

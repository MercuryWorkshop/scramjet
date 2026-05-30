import { basicTest } from "../../testcommon.ts";

// Exact testing-only always-pass branch from inner.js_translated.js:3981-3999:
//   when IThaC9 is 1x...AA/BB, set a timeout and post complete with the
//   literal dummy token "XXXX.DUMMY.TOKEN.XXXX".

export default basicTest({
	name: "cf-inner-testing-only-always-pass-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-testing-pass";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = {
        xpbnF3: widgetId,
        IThaC9: "1x00000000000000000000AA",
        kobE3: child.document,
      };
      child.eval(\`
        window.oIvGL6 = { iLIV6() {}, sbHe4() {}, XkWA7() {}, XVJL7() {} };
        window.nJWjq3 = function() {};
        function s(value) { return value; }

        var q = {
          fpaAR: function(Z, E) { return E === Z; },
          adJfH: '1x00000000000000000000AA',
          UGHqd: function(Z, E) { return Z(E); }
        };
        var f = 'XXXX.DUMMY.TOKEN.XXXX';
        function T() { setInterval(window.oIvGL6.iLIV6, 1000); }

        if (q.fpaAR(window._cf_chl_opt.IThaC9, q.adJfH) || window._cf_chl_opt.IThaC9 === '1x00000000000000000000BB') {
          window.nJWjq3('XuQ5Snxhk9UTvANRhJXP/ne9AgsTjy/YGZKuNY/stHQ=$kc5/FvyRQtlRafRByHThgA==');
          T();
          window.oIvGL6.sbHe4(q.UGHqd(s, 'testing_only_always_pass'));
          setTimeout(function() {
            window.oIvGL6.XkWA7();
            window.oIvGL6.XVJL7();
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              event: 'complete',
              token: f
            }, '*');
          }, 0);
        }
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("testing-only always-pass message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "complete") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.token === "XXXX.DUMMY.TOKEN.XXXX", "testing-only token mismatch");
      assert(result.data.widgetId === widgetId, "testing-only widgetId mismatch");
      assertConsistent("inner-testing-only-always-pass-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

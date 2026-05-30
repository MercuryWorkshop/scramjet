import { basicTest } from "../../testcommon.ts";

// Exact testing-only interactive branch from inner.js_translated.js:4016-4028:
//   when IThaC9 is 3x...FF, ORkf9() returns an element and its click listener
//   posts complete with the dummy token.

export default basicTest({
	name: "cf-inner-testing-only-interactive-click-complete",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-testing-interactive";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, IThaC9: "3x00000000000000000000FF" };
      child.eval(\`
        var button = document.createElement('button');
        button.id = 'interactive-complete';
        document.body.appendChild(button);
        window.nJWjq3 = function() {};
        window.sTuu5 = function() {};
        window.JCzq5 = function() {};
        window.oIvGL6 = {
          iLIV6() {}, sbHe4() {}, hfVAC3() {}, wCKUF9() {},
          ORkf9() { return button; }, UFBd8() {}, xlbh6() {}, gbKD2() {}, XkWA7() {}, XVJL7() {}
        };
        function s(value) { return value; }
        var q = { DiaVt: function(Z) { return Z(); }, OTRpO: 'cloudflare-challenge' };
        var f = 'XXXX.DUMMY.TOKEN.XXXX';
        function T() { setInterval(window.oIvGL6.iLIV6, 1000); }

        if (window._cf_chl_opt.IThaC9 === '3x00000000000000000000FF') {
          window.nJWjq3('smJBWM93WngPanNgThh3/qr7b4mJHbIhE1/Pm2lc924=$pIiMcSPsx0Sxa8AFnWMeGw==');
          q.DiaVt(T);
          window.oIvGL6.sbHe4(s('testing_only'));
          window.oIvGL6.hfVAC3();
          window.oIvGL6.wCKUF9();
          var S = window.oIvGL6.ORkf9();
          if (S) {
            S.addEventListener('click', function() {
              window.oIvGL6.UFBd8();
              window.oIvGL6.xlbh6();
              window.oIvGL6.gbKD2();
              window.oIvGL6.XkWA7();
              window.oIvGL6.XVJL7();
              window.parent.postMessage({
                source: q.OTRpO,
                widgetId: window._cf_chl_opt.xpbnF3,
                event: 'complete',
                token: f
              }, '*');
            });
          }
        }
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("testing-only interactive message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "complete") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("interactive-complete").click();
      });

      assert(result.data.token === "XXXX.DUMMY.TOKEN.XXXX", "interactive token mismatch");
      assert(result.data.widgetId === widgetId, "interactive widgetId mismatch");
      assertConsistent("inner-testing-only-interactive-click-complete", result);
    } finally {
      iframe.remove();
    }
  `,
});

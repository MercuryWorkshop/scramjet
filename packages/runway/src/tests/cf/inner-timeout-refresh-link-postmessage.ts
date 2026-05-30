import { basicTest } from "../../testcommon.ts";

// Exact timeout refresh-link click branch from inner.js_translated.js:3788-3813:
//   if !Y("turnstile-timeout-state") and LLKqf9 !== "never", attach a click
//   listener to #timeout-refresh-link that posts refreshRequest with reason
//   "timeout" to the parent.

export default basicTest({
	name: "cf-inner-timeout-refresh-link-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-timeout-refresh";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, LLKqf9: "auto" };
      child.eval(\`
        var link = document.createElement('a');
        link.id = 'timeout-refresh-link';
        document.body.appendChild(link);

        function Y(key) { return false; }
        function dh(id) { return document.querySelector('#' + id); }
        function dI() {}
        function dM() {}
        function db() {}

        var q = {
          OWznb: 'cloudflare-challenge',
          FOBMP: 'refreshRequest',
          YSJxS: function(W, T) { return W(T); },
          XLiOC: function(W, T) { return W(T); },
          coFUd: 'timeout-refresh-link',
          GGTpp: 'timeout-text',
          kiMxD: function(W, T, f) { return W(T, f); },
          XooLh: 'timeout'
        };

        if (!q.YSJxS(Y, 'turnstile-timeout-state')) {
          if (window._cf_chl_opt.LLKqf9 !== 'never') {
            q.XLiOC(dh, 'timeout-refresh-link').addEventListener('click', function() {
              window.parent.postMessage({
                source: q.OWznb,
                widgetId: window._cf_chl_opt.xpbnF3,
                event: q.FOBMP,
                reason: 'timeout'
              }, '*');
            });
          } else {
            q.XLiOC(dI, q.coFUd);
            dM(q.GGTpp);
          }
          q.kiMxD(db, q.XooLh, 'grid');
        }
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout refresh link message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "refreshRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("timeout-refresh-link").click();
      });

      assert(result.data.source === "cloudflare-challenge", "timeout refresh source mismatch");
      assert(result.data.widgetId === widgetId, "timeout refresh widgetId mismatch");
      assert(result.data.reason === "timeout", "timeout refresh reason mismatch");
      assertConsistent("inner-timeout-refresh-link-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

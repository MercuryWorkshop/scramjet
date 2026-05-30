import { basicTest } from "../../testcommon.ts";

// Exact overrun feedback link branch from inner.js_translated.js:7337-7361:
//   query #error-overrun, attach click listener to #fr-overrun-link, then post
//   feedbackInit with rayId and feedbackOrigin "overrunning".

export default basicTest({
	name: "cf-inner-overrun-feedback-link-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-overrun-feedback";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, puyP7: "ray-overrun", kobE3: child.document };
      child.eval(\`
        var panel = document.createElement('div');
        panel.id = 'error-overrun';
        var link = document.createElement('a');
        link.id = 'fr-overrun-link';
        document.body.append(panel, link);
        function dh(id) { return document.querySelector('#' + id); }
        function db(id, display) { document.querySelector('#' + id).style.display = display; }
        function H() {}
        var q = {
          uQUDT: 'overrunning',
          QvyOE: 'error-overrun',
          GkHZD: function(f, S) { return f + S; },
          XvVGu: function(f, S) { return f(S); },
          IWLPD: 'flex'
        };
        var W = q.QvyOE;
        var T = window._cf_chl_opt.kobE3.querySelector(q.GkHZD('#', W));
        if (T) {
          q.XvVGu(dh, 'fr-overrun-link').addEventListener('click', function() {
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              rayId: window._cf_chl_opt.puyP7,
              feedbackOrigin: q.uQUDT,
              event: 'feedbackInit'
            }, '*');
          });
          db(W, q.IWLPD);
          H();
        }
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("overrun feedback message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "feedbackInit") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              data: event.data,
              display: child.document.getElementById("error-overrun").style.display,
            });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("fr-overrun-link").click();
      });

      assert(result.data.feedbackOrigin === "overrunning", "overrun feedbackOrigin mismatch");
      assert(result.data.rayId === "ray-overrun", "overrun rayId mismatch");
      assert(result.display === "flex", "overrun display side effect mismatch");
      assertConsistent("inner-overrun-feedback-link-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

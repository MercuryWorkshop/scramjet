import { basicTest } from "../../testcommon.ts";

// Exact fail troubleshoot feedback branch from inner.js_translated.js:7022-7044:
//   after showing the fail state, #fr-fail-troubleshoot-link click posts a
//   feedbackInit message with feedbackOrigin "failure" and rayId from _cf_chl_opt.

export default basicTest({
	name: "cf-inner-fail-troubleshoot-feedback-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-fail-troubleshoot";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, puyP7: "ray-fail-troubleshoot" };
      child.eval(\`
        var fail = document.createElement('div');
        fail.id = 'fail';
        var overrun = document.createElement('div');
        overrun.id = 'error-overrun';
        var link = document.createElement('a');
        link.id = 'fr-fail-troubleshoot-link';
        document.body.append(fail, overrun, link);

        function d3() {}
        function dI(id) { document.getElementById(id).hidden = true; }
        function db(id, display) { document.getElementById(id).style.display = display; }
        function dh(id) { return document.getElementById(id); }

        var q = {
          bbWMp: 'cloudflare-challenge',
          Wjofl: function(T) { return T(); },
          VRniA: 'fail',
          HSAjw: 'grid'
        };

        q.Wjofl(d3);
        dI('error-overrun');
        db(q.VRniA, q.HSAjw);
        var W = dh('fr-fail-troubleshoot-link');
        W && W.addEventListener('click', function() {
          window.parent.postMessage({
            source: q.bbWMp,
            widgetId: window._cf_chl_opt.xpbnF3,
            rayId: window._cf_chl_opt.puyP7,
            feedbackOrigin: 'failure',
            event: 'feedbackInit'
          }, '*');
        });
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("fail troubleshoot feedback message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "feedbackInit") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              data: event.data,
              failDisplay: child.document.getElementById("fail").style.display,
              overrunHidden: child.document.getElementById("error-overrun").hidden,
            });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("fr-fail-troubleshoot-link").click();
      });

      assert(result.data.feedbackOrigin === "failure", "fail feedbackOrigin mismatch");
      assert(result.data.rayId === "ray-fail-troubleshoot", "fail feedback rayId mismatch");
      assert(result.failDisplay === "grid", "fail display side effect mismatch");
      assert(result.overrunHidden === true, "overrun hide side effect mismatch");
      assertConsistent("inner-fail-troubleshoot-feedback-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

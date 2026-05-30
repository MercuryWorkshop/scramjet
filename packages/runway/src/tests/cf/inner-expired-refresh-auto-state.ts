import { basicTest } from "../../testcommon.ts";

// Non-"never" expired state from inner.js_translated.js:6393-6404:
//   if !Y("turnstile-expired-state") and fbcuL0 !== "never", attach a click listener
//   to #expired-refresh-link that posts refreshRequest reason "expired"; then db("expired", "grid") and F().

export default basicTest({
	name: "cf-inner-expired-refresh-auto-state",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-expired-auto";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, fbcuL0: "auto" };
      child.eval(\`
        var calls = [];
        var link = document.createElement('a');
        link.id = 'expired-refresh-link';
        var expired = document.createElement('div');
        expired.id = 'expired';
        document.body.append(link, expired);
        function Y(key) { calls.push(['Y', key]); return false; }
        function dh(id) { return document.querySelector('#' + id); }
        function db(id, display) { calls.push(['db', id, display]); dh(id).style.display = display; }
        function F() { calls.push(['F']); }
        function dM(id) { calls.push(['dM', id]); }
        function dI(id) { calls.push(['dI', id]); }

        if (!Y('turnstile-expired-state')) {
          window._cf_chl_opt.fbcuL0 !== 'never' ? dh('expired-refresh-link').addEventListener('click', function() {
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              event: 'refreshRequest',
              reason: 'expired'
            }, '*');
          }) : (dM('expired-text'), dI('expired-refresh-link'));
          db('expired', 'grid');
          F();
        }
        window.__expiredState = function() {
          return { calls: calls.slice(), expiredDisplay: expired.style.display };
        };
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("expired auto refresh timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "refreshRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ data: event.data, state: child.__expiredState() });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("expired-refresh-link").click();
      });

      assert(result.data.source === "cloudflare-challenge", "expired refresh source mismatch");
      assert(result.data.widgetId === widgetId, "expired refresh widgetId mismatch");
      assert(result.data.reason === "expired", "expired refresh reason mismatch");
      assert(result.state.expiredDisplay === "grid", "expired state display mismatch");
      assert(JSON.stringify(result.state.calls) === JSON.stringify([["Y", "turnstile-expired-state"], ["db", "expired", "grid"], ["F"]]), "expired state call sequence mismatch");
      assertConsistent("inner-expired-refresh-auto-state", result);
    } finally {
      iframe.remove();
    }
  `,
});

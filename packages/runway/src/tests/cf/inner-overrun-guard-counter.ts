import { basicTest } from "../../testcommon.ts";

// Guard/counter details from inner.js_translated.js:3739-3754 and 4585-4599:
//   if (Y("overrun-warning")) return;
//   if (d1) return;
//   !_cf_chl_opt.eCwOY2 && (_cf_chl_opt.eCwOY2 = 0);
//   _cf_chl_opt.eCwOY2++;
//   d1 = true; m(); post overrunBegin
// and overrunEnd returns unless d1 is true, then clears d1, calls p(), and posts.

export default basicTest({
	name: "cf-inner-overrun-guard-counter",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-overrun-guard";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        var d1 = false;
        var warningVisible = false;
        var helperCalls = [];
        function Y(key) { return key === 'overrun-warning' && warningVisible; }
        function m() { helperCalls.push('m'); }
        function p() { helperCalls.push('p'); }

        window.__setOverrunWarning = function(value) { warningVisible = value; };
        window.__overrunBegin = function() {
          if (Y('overrun-warning')) return;
          if (d1) return;
          if (!window._cf_chl_opt.eCwOY2) window._cf_chl_opt.eCwOY2 = 0;
          window._cf_chl_opt.eCwOY2++;
          d1 = true;
          m();
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            event: 'overrunBegin'
          }, '*');
        };
        window.__overrunEnd = function() {
          if (Y('overrun-warning')) return;
          if (false === d1) return;
          d1 = false;
          p();
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            event: 'overrunEnd'
          }, '*');
        };
        window.__overrunState = function() {
          return {
            d1,
            eCwOY2: window._cf_chl_opt.eCwOY2,
            helperCalls: helperCalls.slice()
          };
        };
      \`);

      const result = await new Promise((resolve, reject) => {
        const messages = [];
        const timeout = setTimeout(() => reject(new Error("overrun guard messages timed out")), 3000);
        const listener = (event) => {
          if (event.source !== child || !event.data || !String(event.data.event).startsWith("overrun")) return;
          messages.push(event.data);
        };
        window.addEventListener("message", listener);

        child.__setOverrunWarning(true);
        child.__overrunBegin();
        child.__setOverrunWarning(false);
        child.__overrunBegin();
        child.__overrunBegin();
        child.__overrunEnd();
        child.__overrunEnd();
        child.__overrunBegin();

        setTimeout(() => {
          clearTimeout(timeout);
          window.removeEventListener("message", listener);
          resolve({ messages, state: child.__overrunState() });
        }, 250);
      });

      assert(result.messages.map((message) => message.event).join(",") === "overrunBegin,overrunEnd,overrunBegin", "overrun guard event sequence mismatch");
      assert(result.state.eCwOY2 === 2, "overrun counter should increment only for unguarded begins");
      assert(result.state.helperCalls.join(",") === "m,p,m", "overrun helper guard sequence mismatch");
      assert(result.state.d1 === true, "final overrun begin should leave d1 set");
      assertConsistent("inner-overrun-guard-counter", result);
    } finally {
      iframe.remove();
    }
  `,
});

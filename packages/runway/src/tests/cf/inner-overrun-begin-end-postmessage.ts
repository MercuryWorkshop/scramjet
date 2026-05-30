import { basicTest } from "../../testcommon.ts";

// Exact overrun begin/end messages from inner.js_translated.js:3746-3754 and 4591-4599.
// UI helpers m() and p() are no-op counters; only the observable state/message path is ported.

export default basicTest({
	name: "cf-inner-overrun-begin-end-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-overrun";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        var d1 = false;
        var helperCalls = [];
        function m() { helperCalls.push('m'); }
        function p() { helperCalls.push('p'); }
        window.__runOverrun = function() {
          if (!window._cf_chl_opt.eCwOY2) window._cf_chl_opt.eCwOY2 = 0;
          window._cf_chl_opt.eCwOY2++;
          d1 = true;
          m();
          window.parent.postMessage({ source: 'cloudflare-challenge', widgetId: window._cf_chl_opt.xpbnF3, event: 'overrunBegin' }, '*');
          if (false === d1) return;
          d1 = false;
          p();
          window.parent.postMessage({ source: 'cloudflare-challenge', widgetId: window._cf_chl_opt.xpbnF3, event: 'overrunEnd' }, '*');
        };
        window.__overrunState = function() { return { eCwOY2: window._cf_chl_opt.eCwOY2, helperCalls: helperCalls.slice() }; };
      \`);

      const result = await new Promise((resolve, reject) => {
        const messages = [];
        const timeout = setTimeout(() => reject(new Error("overrun messages timed out")), 3000);
        const listener = (event) => {
          if (event.source !== child || !event.data || !String(event.data.event).startsWith("overrun")) return;
          messages.push({ origin: event.origin, data: event.data });
          if (messages.length === 2) {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, state: child.__overrunState(), messages });
          }
        };
        window.addEventListener("message", listener);
        child.__runOverrun();
      });

      assert(result.state.eCwOY2 === 1, "overrun counter should increment once");
      assert(result.messages[0].data.event === "overrunBegin", "first overrun event mismatch");
      assert(result.messages[1].data.event === "overrunEnd", "second overrun event mismatch");
      assertConsistent("inner-overrun-begin-end-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

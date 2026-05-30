import { basicTest } from "../../testcommon.ts";

// Exact interactive timeout postMessage from inner.js_translated.js:3276-3283:
//
//   if (!YFNJ6) {
//     _cf_chl_opt.YyXhA9 = 1
//     parent.postMessage({ source: "cloudflare-challenge", widgetId, event:
//       "interactiveTimeout" }, "*")
//     if (_cf_chl_opt.LLKqf9 !== "auto") run refresh helpers
//   }

export default basicTest({
	name: "cf-inner-interactive-timeout-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-interactive-timeout";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, LLKqf9: "auto" };
      child.eval(` +
		"`" +
		`
        if (!window.YFNJ6) {
          window._cf_chl_opt.YyXhA9 = 1;
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            event: 'interactiveTimeout'
          }, '*');
        }
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("interactiveTimeout timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "interactiveTimeout") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              optFlag: child._cf_chl_opt.YyXhA9,
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.optFlag === 1, "interactive timeout should set _cf_chl_opt.YyXhA9");
      assert(result.data.source === "cloudflare-challenge", "interactive source mismatch");
      assert(result.data.widgetId === widgetId, "interactive widgetId mismatch");
      assert(result.data.event === "interactiveTimeout", "interactive event mismatch");
      assertConsistent("inner-interactive-timeout-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

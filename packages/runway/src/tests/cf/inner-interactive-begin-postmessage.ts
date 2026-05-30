import { basicTest } from "../../testcommon.ts";

// Exact terminal interactiveBegin postMessage from inner.js_translated.js:7128-7138.
// Surrounding UI/timer helpers are not modeled; this preserves the observable postMessage block.

export default basicTest({
	name: "cf-inner-interactive-begin-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-interactive-begin";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        window.parent.postMessage({
          source: 'cloudflare-challenge',
          widgetId: window._cf_chl_opt.xpbnF3,
          event: 'interactiveBegin'
        }, '*');
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("interactiveBegin timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "interactiveBegin") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.source === "cloudflare-challenge", "interactiveBegin source mismatch");
      assert(result.data.widgetId === widgetId, "interactiveBegin widgetId mismatch");
      assert(result.data.event === "interactiveBegin", "interactiveBegin event mismatch");
      assertConsistent("inner-interactive-begin-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

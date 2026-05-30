import { basicTest } from "../../testcommon.ts";

// Exact interactiveEnd postMessage from inner.js_translated.js:6300-6310:
//
//   parent.postMessage({ source: "cloudflare-challenge", widgetId,
//     event: "interactiveEnd" }, "*")

export default basicTest({
	name: "cf-inner-interactive-end-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-interactive-end";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(` +
		"`" +
		`
        window.parent.postMessage({
          source: 'cloudflare-challenge',
          widgetId: window._cf_chl_opt.xpbnF3,
          event: 'interactiveEnd'
        }, '*');
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("interactiveEnd timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "interactiveEnd") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.source === "cloudflare-challenge", "interactiveEnd source mismatch");
      assert(result.data.widgetId === widgetId, "interactiveEnd widgetId mismatch");
      assert(result.data.event === "interactiveEnd", "interactiveEnd event mismatch");
      assertConsistent("inner-interactive-end-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

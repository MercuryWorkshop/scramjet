import { basicTest } from "../../testcommon.ts";

// Exact reloadApiJsRequest postMessage helper from inner.js_translated.js:5939-5946:
//   parent.postMessage({ event: "reloadApiJsRequest", source, widgetId }, "*").

export default basicTest({
	name: "cf-inner-reload-api-js-request-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-reload-api-js";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        var W = { eFfDO: 'cloudflare-challenge' };
        window.parent.postMessage({
          event: 'reloadApiJsRequest',
          source: W.eFfDO,
          widgetId: window._cf_chl_opt.xpbnF3
        }, '*');
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("reloadApiJsRequest message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "reloadApiJsRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.source === "cloudflare-challenge", "reloadApiJsRequest source mismatch");
      assert(result.data.widgetId === widgetId, "reloadApiJsRequest widgetId mismatch");
      assertConsistent("inner-reload-api-js-request-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

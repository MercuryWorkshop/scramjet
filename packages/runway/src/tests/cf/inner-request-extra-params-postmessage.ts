import { basicTest } from "../../testcommon.ts";

// Exact requestExtraParams postMessage from inner.js_translated.js:5751-5753
// and 5925-5932:
//
//   parent.postMessage({ source: "cloudflare-challenge", widgetId,
//     event: "requestExtraParams" }, "*")

export default basicTest({
	name: "cf-inner-request-extra-params-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-extra-params";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(` +
		"`" +
		`
        var W = { eFfDO: 'cloudflare-challenge', yHfOh: 'requestExtraParams' };
        window.parent.postMessage({
          source: W.eFfDO,
          widgetId: window._cf_chl_opt.xpbnF3,
          event: W.yHfOh
        }, '*');
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("requestExtraParams timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "requestExtraParams") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.source === "cloudflare-challenge", "requestExtraParams source mismatch");
      assert(result.data.widgetId === widgetId, "requestExtraParams widgetId mismatch");
      assert(result.data.event === "requestExtraParams", "requestExtraParams event mismatch");
      assertConsistent("inner-request-extra-params-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

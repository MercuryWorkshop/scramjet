import { basicTest } from "../../testcommon.ts";

// Exact expired refresh click postMessage from inner.js_translated.js:6393-6401:
//
//   expired-refresh-link click -> parent.postMessage({ source:
//     "cloudflare-challenge", widgetId, event: "refreshRequest", reason:
//     "expired" }, "*")

export default basicTest({
	name: "cf-inner-refresh-request-expired-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-refresh-expired";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(` +
		"`" +
		`
        var link = document.createElement('a');
        link.id = 'expired-refresh-link';
        document.body.appendChild(link);
        link.addEventListener('click', function() {
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            event: 'refreshRequest',
            reason: 'expired'
          }, '*');
        });
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("refreshRequest expired timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "refreshRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("expired-refresh-link").click();
      });

      assert(result.data.source === "cloudflare-challenge", "refreshRequest source mismatch");
      assert(result.data.widgetId === widgetId, "refreshRequest widgetId mismatch");
      assert(result.data.event === "refreshRequest", "refreshRequest event mismatch");
      assert(result.data.reason === "expired", "refreshRequest reason mismatch");
      assertConsistent("inner-refresh-request-expired-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

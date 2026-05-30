import { basicTest } from "../../testcommon.ts";

// Ports dB() widgetStale postMessage from data4/inner.js_translated.js:7046-7060.

export default basicTest({
	name: "cf-inner-widget-stale-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-stale";
    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(` +
		"`" +
		`
        window.dB = function() {
          window.parent.postMessage({
            source: "cloudflare-challenge",
            widgetId: window._cf_chl_opt.xpbnF3,
            event: "widgetStale",
          }, "*");
        };
      ` +
		"`" +
		`);

      const messagePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timed out waiting for widgetStale")), 3000);
        function onMessage(event) {
          if (event.data?.widgetId !== widgetId || event.data?.event !== "widgetStale") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve(event.data);
        }
        window.addEventListener("message", onMessage);
      });
      child.dB();
      const message = await messagePromise;
      const observed = { message };
      assert(message.source === "cloudflare-challenge", "widgetStale source should match");
      assertConsistent("inner-widget-stale-postmessage", observed);
    } finally {
      iframe.remove();
    }
  `,
});

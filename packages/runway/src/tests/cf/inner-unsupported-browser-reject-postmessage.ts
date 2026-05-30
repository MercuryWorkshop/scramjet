import { basicTest } from "../../testcommon.ts";

// Ports the unsupported-browser reject envelope from data4/inner.js_translated.js:4265-4278.

export default basicTest({
	name: "cf-inner-unsupported-browser-reject-postmessage",
	timeoutMs: 10000,
	js:
		`
    const widgetId = "runway-widget-unsupported-browser";
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);

    try {
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, IHoc8: "x", ziQHw8: [] };
      child.eval(` +
		"`" +
		`
        window.__runUnsupportedBrowser = () => {
          if (window._cf_chl_opt.IHoc8 !== "d") window._cf_chl_opt.IHoc8 = "d";
          else return;
          window._cf_chl_opt.KzXIP8 = Date.now();
          const unsupported = true;
          if (unsupported) {
            window.parent.postMessage({
              source: "cloudflare-challenge",
              widgetId: window._cf_chl_opt.xpbnF3,
              reason: "unsupported_browser",
              event: "reject",
            }, "*");
            return false;
          }
          return true;
        };
      ` +
		"`" +
		`);

      const message = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timed out waiting for reject")), 3000);
        function onMessage(event) {
          if (event.source !== child || event.data?.widgetId !== widgetId || event.data?.event !== "reject") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve({ data: event.data, sourceMatchesIframe: event.source === child });
        }
        window.addEventListener("message", onMessage);
        child.__runUnsupportedBrowser();
      });

      const observed = { message: message.data, sourceMatchesIframe: message.sourceMatchesIframe, IHoc8: child._cf_chl_opt.IHoc8, timestampType: typeof child._cf_chl_opt.KzXIP8 };
      assert(message.data.event === "reject", "unsupported browser should reject");
      assert(message.data.reason === "unsupported_browser", "reject reason should be unsupported_browser");
      assert(message.sourceMatchesIframe === true, "reject should be posted from iframe realm");
      assertConsistent("inner-unsupported-browser-reject-postmessage", observed);
    } finally {
      iframe.remove();
    }
  `,
});

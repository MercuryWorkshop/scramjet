import { basicTest } from "../../testcommon.ts";

// Ports interactiveEnd cleanup/postMessage from data4/inner.js_translated.js:6279-6310.

export default basicTest({
	name: "cf-inner-interactive-end-cleanup-state",
	timeoutMs: 10000,
	js:
		`
    const widgetId = "runway-widget-interactive-end-cleanup";
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    try {
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(` +
		"`" +
		`
        window.__calls = [];
        window.__runInteractiveEnd = () => {
          window.__df = false;
          window.__calls.push("dG", "dd", "d5", "d7", "clearTimeout", "dD");
          window.parent.postMessage({ source: "cloudflare-challenge", widgetId: window._cf_chl_opt.xpbnF3, event: "interactiveEnd" }, "*");
        };
      ` +
		"`" +
		`);

      const message = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timed out waiting for interactiveEnd")), 3000);
        function onMessage(event) {
          if (event.source !== child || event.data?.widgetId !== widgetId || event.data?.event !== "interactiveEnd") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve({ data: event.data, sourceMatchesIframe: event.source === child });
        }
        window.addEventListener("message", onMessage);
        child.__runInteractiveEnd();
      });

      const observed = { message: message.data, sourceMatchesIframe: message.sourceMatchesIframe, calls: child.__calls, df: child.__df };
      assert(message.data.event === "interactiveEnd", "dE should post interactiveEnd");
      assert(message.sourceMatchesIframe === true, "interactiveEnd should be posted from iframe realm");
      assert(child.__df === false, "dE should clear interactive df state");
      assertConsistent("inner-interactive-end-cleanup-state", observed);
    } finally {
      iframe.remove();
    }
  `,
});

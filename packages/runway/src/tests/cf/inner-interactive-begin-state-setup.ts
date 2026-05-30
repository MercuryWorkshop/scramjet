import { basicTest } from "../../testcommon.ts";

// Ports interactiveBegin side effects from data4/inner.js_translated.js:7101-7138.

export default basicTest({
	name: "cf-inner-interactive-begin-state-setup",
	timeoutMs: 10000,
	js:
		`
    const widgetId = "runway-widget-interactive-begin-state";
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    try {
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, FPOXp5: 25, ziQHw8: [], kobE3: child.document.body };
      child.eval(` +
		"`" +
		`
        window.__calls = [];
        window.__df = false;
        window.__runInteractiveBegin = () => {
          window.__df = true;
          window.__calls.push("dG", "d9", "d3", "d5", "d6", "setTimeout:dk", "szzZs3");
          window.parent.postMessage({ source: "cloudflare-challenge", widgetId: window._cf_chl_opt.xpbnF3, event: "interactiveBegin" }, "*");
        };
      ` +
		"`" +
		`);

      const message = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timed out waiting for interactiveBegin")), 3000);
        function onMessage(event) {
          if (event.source !== child || event.data?.widgetId !== widgetId || event.data?.event !== "interactiveBegin") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve({ data: event.data, sourceMatchesIframe: event.source === child });
        }
        window.addEventListener("message", onMessage);
        child.__runInteractiveBegin();
      });

      const observed = { message: message.data, sourceMatchesIframe: message.sourceMatchesIframe, calls: child.__calls, df: child.__df };
      assert(message.data.event === "interactiveBegin", "dZ should post interactiveBegin");
      assert(message.sourceMatchesIframe === true, "interactiveBegin should be posted from iframe realm");
      assert(child.__df === true, "dZ should set interactive df state");
      assertConsistent("inner-interactive-begin-state-setup", observed);
    } finally {
      iframe.remove();
    }
  `,
});

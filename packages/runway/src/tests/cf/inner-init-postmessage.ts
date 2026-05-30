import { basicTest } from "../../testcommon.ts";

// Exact init postMessage from inner.js_translated.js:5751-5784 and 5864-5873:
//
//   setTimeout(function() {
//     parent.postMessage({ source: "cloudflare-challenge", widgetId,
//       event: "init", mode, nextRcV }, "*")
//     q6()
//   }, 0)

export default basicTest({
	name: "cf-inner-init-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-init",
      EEArb6: "managed",
      Lgky2: "rcv-init-runway",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(` +
		"`" +
		`
        var W = { eFfDO: 'cloudflare-challenge', eDRHk: 'init' };
        window.setTimeout(function() {
          window.parent.postMessage({
            source: W.eFfDO,
            widgetId: window._cf_chl_opt.xpbnF3,
            event: W.eDRHk,
            mode: window._cf_chl_opt.EEArb6,
            nextRcV: window._cf_chl_opt.Lgky2
          }, '*');
        }, 0);
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("init postMessage timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "init") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.source === "cloudflare-challenge", "init source mismatch");
      assert(result.data.widgetId === opts.xpbnF3, "init widgetId mismatch");
      assert(result.data.event === "init", "init event mismatch");
      assert(result.data.mode === opts.EEArb6, "init mode mismatch");
      assert(result.data.nextRcV === opts.Lgky2, "init nextRcV mismatch");
      assertConsistent("inner-init-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

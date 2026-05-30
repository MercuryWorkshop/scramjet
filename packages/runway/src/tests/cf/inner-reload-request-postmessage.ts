import { basicTest } from "../../testcommon.ts";

// Exact translated GWrU4 function from inner.js_translated.js:649-657:
//
//   _cf_chl_opt.GWrU4 = function(refreshTrigger) {
//     window.parent.postMessage({
//       trigger: refreshTrigger,
//       source: "cloudflare-challenge",
//       widgetId: "3ipt2",
//       nextRcV: "l61M2z8TjWFgQxaWlsy5GMfY2cOcBy.tSP1w8zSzm0A-1779715219-1.3.1.1-szqa8K_6pjiIAXTlWLSu4d8uTCv7mUG.D2pguzyNdis",
//       event: "reloadRequest"
//     }, "*");
//   }

export default basicTest({
	name: "cf-inner-reload-request-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const trigger = "runway-refresh-trigger";
    const nextRcV = "l61M2z8TjWFgQxaWlsy5GMfY2cOcBy.tSP1w8zSzm0A-1779715219-1.3.1.1-szqa8K_6pjiIAXTlWLSu4d8uTCv7mUG.D2pguzyNdis";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child.eval(\`
        window._cf_chl_opt = window._cf_chl_opt || {};
        window._cf_chl_opt.GWrU4 = function(refreshTrigger) {
          window.parent.postMessage({
            trigger: refreshTrigger,
            source: 'cloudflare-challenge',
            widgetId: '3ipt2',
            nextRcV: 'l61M2z8TjWFgQxaWlsy5GMfY2cOcBy.tSP1w8zSzm0A-1779715219-1.3.1.1-szqa8K_6pjiIAXTlWLSu4d8uTCv7mUG.D2pguzyNdis',
            event: 'reloadRequest'
          }, '*');
        };
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("reloadRequest timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "reloadRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
        child._cf_chl_opt.GWrU4(trigger);
      });

      assert(result.data.trigger === trigger, "reload trigger mismatch");
      assert(result.data.source === "cloudflare-challenge", "reload source mismatch");
      assert(result.data.widgetId === "3ipt2", "reload widgetId mismatch");
      assert(result.data.nextRcV === nextRcV, "reload nextRcV mismatch");
      assert(result.data.event === "reloadRequest", "reload event mismatch");
      assertConsistent("inner-reload-request-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

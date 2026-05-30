import { basicTest } from "../../testcommon.ts";

// Exact translated inner handler from inner.js_translated.js:659-670:
//
//   window.addEventListener("message", handler)
//   const e = event.data
//   if (e.source && e.source === "cloudflare-challenge" &&
//       e.event === "meow" && e.widgetId === window._cf_chl_opt.xpbnF3) {
//     window.parent.postMessage({
//       source: "cloudflare-challenge",
//       widgetId: window._cf_chl_opt.xpbnF3,
//       event: "food",
//       seq: e.seq
//     }, "*")
//   }

export default basicTest({
	name: "cf-inner-parent-meow-food",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-3ipt2";
    const seq = "seq-runway-food";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        var handler = function(event) {
          var e = event.data;
          if (e.source && e.source === 'cloudflare-challenge' && e.event === 'meow' && e.widgetId === window._cf_chl_opt.xpbnF3) {
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              event: 'food',
              seq: e.seq
            }, '*');
          }
        };
        window.addEventListener('message', handler);
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("food response timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "food") {
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
        child.postMessage({
          source: "cloudflare-challenge",
          event: "meow",
          widgetId,
          seq,
        }, "*");
      });

      assert(result.data.source === "cloudflare-challenge", "food source literal mismatch");
      assert(result.data.widgetId === widgetId, "food widgetId mismatch");
      assert(result.data.event === "food", "food event mismatch");
      assert(result.data.seq === seq, "food seq mismatch");
      assertConsistent("inner-parent-meow-food", result);
    } finally {
      iframe.remove();
    }
  `,
});

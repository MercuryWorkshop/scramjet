import { basicTest } from "../../testcommon.ts";

// Exact translated fail timeout postMessage from inner.js_translated.js:787-810:
//
//   T.nxhNq = "cloudflare-challenge"
//   T.GejaS = "fail"
//   T.TTtLP = "300010"
//   S = 1000 * Math.min(2.7 << f, 32), with f = 1
//   parent.postMessage({ source, widgetId, event, cfChlOut, cfChlOutS,
//     code, rcV, frMd }, "*")

export default basicTest({
	name: "cf-inner-fail-timeout-postmessage",
	timeoutMs: 10000,
	js:
		`
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-timeout",
      VNUtN0: "cf-out-runway",
      IWdn9: "cf-out-s-runway",
      Lgky2: "rcv-runway",
      qxzT2: "frmd-runway",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(` +
		"`" +
		`
        var T = { nxhNq: 'cloudflare-challenge', GejaS: 'fail', TTtLP: '300010' };
        var f = 1;
        var S = 1000 * window.Math.min(2.7 << f, 32);
        window.__cfTimeoutDelay = S;
        window.setTimeout(function() {
          window.YFNJ6 = true;
          window.parent.postMessage({
            source: T.nxhNq,
            widgetId: window._cf_chl_opt.xpbnF3,
            event: T.GejaS,
            cfChlOut: window._cf_chl_opt.VNUtN0,
            cfChlOutS: window._cf_chl_opt.IWdn9,
            code: T.TTtLP,
            rcV: window._cf_chl_opt.Lgky2,
            frMd: window._cf_chl_opt.qxzT2
          }, '*');
        }, 0);
      ` +
		"`" +
		`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("fail timeout postMessage timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.code === "300010") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              timeoutDelay: child.__cfTimeoutDelay,
              childYFNJ6: child.YFNJ6,
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.timeoutDelay === 4000, "computed timeout delay should be 4000");
      assert(result.childYFNJ6 === true, "YFNJ6 should be true after timeout path");
      assert(result.data.source === "cloudflare-challenge", "fail source mismatch");
      assert(result.data.widgetId === opts.xpbnF3, "fail widgetId mismatch");
      assert(result.data.event === "fail", "fail event mismatch");
      assert(result.data.code === "300010", "fail code mismatch");
      assertConsistent("inner-fail-timeout-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

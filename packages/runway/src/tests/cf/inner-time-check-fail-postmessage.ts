import { basicTest } from "../../testcommon.ts";

// Exact time-check fail branch from inner.js_translated.js:7188-7205:
//   abs(floor(Date.now()/1000) - parseInt(_cf_chl_opt.CjLF6, 10)) > q
//   querySelector("#content"), style.display = "flex", YFNJ6 = true, fail postMessage.

export default basicTest({
	name: "cf-inner-time-check-fail-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const staleSeconds = String(Math.floor(Date.now() / 1000) - 100000);
    const opts = {
      xpbnF3: "runway-widget-time-check",
      Lgky2: "rcv-time-check",
      VNUtN0: "out-time-check",
      IWdn9: "outs-time-check",
      qxzT2: "frmd-time-check",
      CjLF6: staleSeconds,
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(\`
        var root = document.createElement('div');
        var content = document.createElement('div');
        content.id = 'content';
        root.appendChild(content);
        window._cf_chl_opt.kobE3 = root;
        window.__runTimeCheck = function(q, f) {
          if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(window._cf_chl_opt.CjLF6, 10)) > q) {
            var D = window._cf_chl_opt.kobE3.querySelector('#content');
            D && (D.style.display = 'flex');
            window.YFNJ6 = true;
            window.parent.postMessage({
              source: 'cloudflare-challenge',
              widgetId: window._cf_chl_opt.xpbnF3,
              rcV: window._cf_chl_opt.Lgky2,
              event: 'fail',
              cfChlOut: window._cf_chl_opt.VNUtN0,
              cfChlOutS: window._cf_chl_opt.IWdn9,
              code: f,
              frMd: window._cf_chl_opt.qxzT2
            }, '*');
            return false;
          }
          return true;
        };
        window.__timeContentDisplay = function() { return content.style.display; };
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("time-check fail timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "fail") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              returnValue: child.__timeCheckReturn,
              display: child.__timeContentDisplay(),
              YFNJ6: child.YFNJ6,
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
        child.__timeCheckReturn = child.__runTimeCheck(1, "200100");
      });

      assert(result.returnValue === false, "time-check fail branch should return false");
      assert(result.display === "flex", "#content display should be flex");
      assert(result.YFNJ6 === true, "YFNJ6 should be true");
      assert(result.data.code === "200100", "time-check fail code mismatch");
      assertConsistent("inner-time-check-fail-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

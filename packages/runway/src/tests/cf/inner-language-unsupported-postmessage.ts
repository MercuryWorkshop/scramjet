import { basicTest } from "../../testcommon.ts";

// Exact languageUnsupported branch from inner.js_translated.js:4691-4699:
//   f = _cf_chl_opt.mJFtX5.lang; if IdPoo4 !== "auto" and f.indexOf(IdPoo4)
//   is -1, parent.postMessage({ source, widgetId, event: "languageUnsupported",
//   fallback: f }, "*").

export default basicTest({
	name: "cf-inner-language-unsupported-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-language-unsupported";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = {
        xpbnF3: widgetId,
        IdPoo4: "zz-ZZ",
        mJFtX5: { lang: "en-US", rtl: false },
      };
      child.eval(\`
        var T = {
          yoCMx: 'auto',
          LaxFm: function(N, D) { return N + D; },
          xtEFf: function(N, D) { return D !== N; },
          YtgBS: 'ltr',
          LomZa: 'turnstile_iframe_alt'
        };
        var f = window._cf_chl_opt.mJFtX5.lang;
        var S = window._cf_chl_opt.mJFtX5.rtl;
        window._cf_chl_opt.gYZPc3 = window._cf_chl_opt.IdPoo4 === undefined || window._cf_chl_opt.IdPoo4 === T.yoCMx ? f : T.LaxFm('set:', window._cf_chl_opt.IdPoo4);
        T.xtEFf(window._cf_chl_opt.IdPoo4, T.yoCMx) && f.indexOf(window._cf_chl_opt.IdPoo4) === -1 && window.parent.postMessage({
          source: 'cloudflare-challenge',
          widgetId: window._cf_chl_opt.xpbnF3,
          event: 'languageUnsupported',
          fallback: f
        }, '*');
        document.documentElement.lang = f;
        S ? document.documentElement.dir = 'rtl' : document.documentElement.dir = T.YtgBS;
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("languageUnsupported message timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "languageUnsupported") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              data: event.data,
              gYZPc3: child._cf_chl_opt.gYZPc3,
              lang: child.document.documentElement.lang,
              dir: child.document.documentElement.dir,
            });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.data.fallback === "en-US", "languageUnsupported fallback mismatch");
      assert(result.data.widgetId === widgetId, "languageUnsupported widgetId mismatch");
      assert(result.gYZPc3 === "set:zz-ZZ", "languageUnsupported gYZPc3 side effect mismatch");
      assertConsistent("inner-language-unsupported-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

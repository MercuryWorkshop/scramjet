import { basicTest } from "../../testcommon.ts";

// Auto-language/RTL branch from inner.js_translated.js:4691-4711:
//   IdPoo4 === "auto" stores gYZPc3 = mJFtX5.lang, skips languageUnsupported,
//   writes documentElement.lang/dir, then posts translationInit with displayRtl and translationData.

export default basicTest({
	name: "cf-inner-translation-auto-rtl-state",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-translation-auto-rtl";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = {
        xpbnF3: widgetId,
        IdPoo4: "auto",
        mJFtX5: { lang: "ar-EG", rtl: true },
      };
      child.eval(\`
        var T = {
          yoCMx: 'auto',
          LaxFm: function(a, b) { return a + b; },
          xtEFf: function(a, b) { return b !== a; },
          YtgBS: 'ltr',
          LomZa: 'turnstile_iframe_alt'
        };
        function s(key) { return key === 'turnstile_iframe_alt' ? 'Widget containing a Cloudflare security challenge' : key; }
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
        window.parent.postMessage({
          source: 'cloudflare-challenge',
          widgetId: window._cf_chl_opt.xpbnF3,
          event: 'translationInit',
          displayLanguage: f,
          displayRtl: S,
          translationData: { turnstile_iframe_alt: s(T.LomZa) }
        }, '*');
      \`);

      const result = await new Promise((resolve) => {
        const messages = [];
        const listener = (event) => {
          if (event.source !== child || !event.data) return;
          if (event.data.event === "languageUnsupported" || event.data.event === "translationInit") messages.push(event.data);
        };
        window.addEventListener("message", listener);
        setTimeout(() => {
          window.removeEventListener("message", listener);
          resolve({
            messages,
            gYZPc3: child._cf_chl_opt.gYZPc3,
            lang: child.document.documentElement.lang,
            dir: child.document.documentElement.dir,
          });
        }, 250);
      });

      assert(result.messages.length === 1, "auto language should only post translationInit");
      assert(result.messages[0].event === "translationInit", "translationInit event missing");
      assert(result.messages[0].displayLanguage === "ar-EG", "displayLanguage mismatch");
      assert(result.messages[0].displayRtl === true, "displayRtl mismatch");
      assert(result.messages[0].translationData.turnstile_iframe_alt === "Widget containing a Cloudflare security challenge", "translationData alt mismatch");
      assert(result.gYZPc3 === "ar-EG", "auto language gYZPc3 mismatch");
      assert(result.lang === "ar-EG", "documentElement.lang mismatch");
      assert(result.dir === "rtl", "documentElement.dir mismatch");
      assertConsistent("inner-translation-auto-rtl-state", result);
    } finally {
      iframe.remove();
    }
  `,
});

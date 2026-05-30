import { basicTest } from "../../testcommon.ts";

// Exact translation init block from inner.js_translated.js:4681-4711:
// reads _cf_chl_opt.mJFtX5.{lang,rtl}, IdPoo4, writes gYZPc3/documentElement
// lang+dir, conditionally posts languageUnsupported, then posts translationInit.

export default basicTest({
	name: "cf-inner-translation-init-postmessage",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-translation",
      mJFtX5: { lang: "en-US", rtl: false },
      IdPoo4: "fr",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(\`
        var T = {
          yoCMx: 'auto',
          LaxFm: function(a, b) { return a + b; },
          xtEFf: function(a, b) { return b !== a; },
          YtgBS: 'ltr',
          LomZa: 'turnstile_iframe_alt'
        };
        function s(key) { return key === 'turnstile_iframe_alt' ? 'Widget%20containing%20a%20Cloudflare%20security%20challenge' : key; }
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

      const result = await new Promise((resolve, reject) => {
        const messages = [];
        const timeout = setTimeout(() => reject(new Error("translationInit timed out")), 3000);
        const listener = (event) => {
          if (event.source !== child || !event.data) return;
          if (event.data.event === "languageUnsupported" || event.data.event === "translationInit") {
            messages.push({ origin: event.origin, data: event.data });
          }
          if (messages.some((message) => message.data.event === "translationInit")) {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({
              sourceMatchesIframe: event.source === child,
              gYZPc3: child._cf_chl_opt.gYZPc3,
              lang: child.document.documentElement.lang,
              dir: child.document.documentElement.dir,
              messages,
            });
          }
        };
        window.addEventListener("message", listener);
      });

      assert(result.gYZPc3 === "set:fr", "gYZPc3 should preserve set:IdPoo4 branch");
      assert(result.lang === "en-US", "documentElement.lang mismatch");
      assert(result.dir === "ltr", "documentElement.dir mismatch");
      assert(result.messages.length === 2, "expected languageUnsupported and translationInit messages");
      assert(result.messages[0].data.event === "languageUnsupported", "languageUnsupported event missing");
      assert(result.messages[1].data.event === "translationInit", "translationInit event missing");
      assertConsistent("inner-translation-init-postmessage", result);
    } finally {
      iframe.remove();
    }
  `,
});

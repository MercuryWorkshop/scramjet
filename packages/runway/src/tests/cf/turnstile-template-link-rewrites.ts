import { basicTest } from "../../testcommon.ts";

// Translation/template rewrite helper from inner.js_translated.js:6782-6786:
// it rewrites challenge.supported_browsers, refresh_link, botnet_link,
// troubleshooting_doc, and %{placeholder.com} inside decoded translation strings.

export default basicTest({
	name: "cf-turnstile-template-link-rewrites",
	js: `
    const previousCfOpt = window._cf_chl_opt;

    try {
      window._cf_chl_opt = { NJat3: "dark", yPpKA1: "replacement-host.invalid" };
      function s(key) {
        const values = {
          "challenge.supported_browsers": "https://developers.cloudflare.com/fundamentals/get-started/concepts/cloudflare-challenges/#browser-support",
          "challenge.botnet": "https://example.test/botnet",
          "challenge.troubleshoot": "https://example.test/troubleshoot",
        };
        return values[key];
      }
      function rewrite(q, encoded) {
        let f = decodeURIComponent(JSON.parse('"' + encoded.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'));
        if (q === "browser_not_supported_aux") f = f.replace("challenge.supported_browsers", s("challenge.supported_browsers"));
        if (f.indexOf('class="refresh_link"') !== -1) f = f.replace('class="refresh_link"', 'class="refresh_link" href="#" data-cf-reload-id="' + q + '"');
        if (f.indexOf('class="botnet_link"') !== -1) f = f.replace('class="botnet_link"', 'class="botnet_link" href="' + s("challenge.botnet") + '/?mkt=false&theme=' + window._cf_chl_opt.NJat3 + '" target="_blank" rel="noopener noreferrer"');
        if (f.indexOf("troubleshooting_doc") !== -1) f = f.replace('class="troubleshooting_doc"', 'class="troubleshooting_doc" target="_blank" rel="noopener noreferrer" href="' + s("challenge.troubleshoot") + '"');
        if (f.indexOf("%{placeholder.com}") !== -1 && window._cf_chl_opt.yPpKA1) f = f.replace("%{placeholder.com}", window._cf_chl_opt.yPpKA1);
        return f;
      }

      const encoded = encodeURIComponent('See challenge.supported_browsers <a class="refresh_link">refresh</a> <a class="botnet_link">botnet</a> <a class="troubleshooting_doc">help</a> %{placeholder.com}');
      const html = rewrite("browser_not_supported_aux", encoded);
      const template = document.createElement("template");
      template.innerHTML = html;
      const refresh = template.content.querySelector(".refresh_link");
      const botnet = template.content.querySelector(".botnet_link");
      const troubleshooting = template.content.querySelector(".troubleshooting_doc");
      const observed = {
        hasSupportedBrowsersUrl: html.includes("#browser-support"),
        refreshHref: refresh && refresh.getAttribute("href"),
        refreshReloadId: refresh && refresh.getAttribute("data-cf-reload-id"),
        botnetHref: botnet && botnet.getAttribute("href"),
        botnetTarget: botnet && botnet.getAttribute("target"),
        botnetRel: botnet && botnet.getAttribute("rel"),
        troubleshootingHref: troubleshooting && troubleshooting.getAttribute("href"),
        placeholderRemoved: !html.includes("%{placeholder.com}"),
        placeholderReplacementPresent: html.includes("replacement-host.invalid"),
      };

      assert(observed.hasSupportedBrowsersUrl, "supported browsers placeholder should be rewritten");
      assert(observed.refreshHref === "#" && observed.refreshReloadId === "browser_not_supported_aux", "refresh link rewrite mismatch");
      assert(observed.botnetHref === "https://example.test/botnet/?mkt=false&theme=dark", "botnet href rewrite mismatch");
      assert(observed.botnetTarget === "_blank" && observed.botnetRel === "noopener noreferrer", "botnet security attrs mismatch");
      assert(observed.troubleshootingHref === "https://example.test/troubleshoot", "troubleshooting href rewrite mismatch");
      assert(observed.placeholderRemoved && observed.placeholderReplacementPresent, "domain placeholder should be replaced");
      assertConsistent("turnstile-template-link-rewrites", observed);
    } finally {
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});

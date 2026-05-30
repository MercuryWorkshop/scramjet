import { basicTest } from "../../testcommon.ts";

// Footer link mode rewrite from inner.js_translated.js:6785:
// footer_text replaces "Cloudflare" with a link whose utm_campaign is "l" for
// interactive, "m" for managed, and "j" for other/default modes.

export default basicTest({
	name: "cf-turnstile-footer-cloudflare-link-mode",
	js: `
    const previousCfOpt = window._cf_chl_opt;

    try {
      function footerForMode(mode) {
        window._cf_chl_opt = { vKOHo9: mode };
        let f = "Protected by Cloudflare";
        let E = "j";
        if (window._cf_chl_opt.vKOHo9 === "interactive") E = "l";
        else if (window._cf_chl_opt.vKOHo9 === "managed") E = "m";
        return f.replace("Cloudflare", '<a rel="noopener noreferrer" href="https://www.cloudflare.com?utm_source=challenge&utm_campaign=' + E + '" target="_blank">Cloudflare</a>');
      }

      function campaign(html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        return new URL(template.content.querySelector("a").href).searchParams.get("utm_campaign");
      }

      const observed = {
        interactive: campaign(footerForMode("interactive")),
        managed: campaign(footerForMode("managed")),
        defaultMode: campaign(footerForMode("non-interactive")),
      };

      assert(observed.interactive === "l", "interactive footer campaign mismatch");
      assert(observed.managed === "m", "managed footer campaign mismatch");
      assert(observed.defaultMode === "j", "default footer campaign mismatch");
      assertConsistent("turnstile-footer-cloudflare-link-mode", observed);
    } finally {
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});

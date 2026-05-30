import { basicTest } from "../../testcommon.ts";

// Ports footer terms/privacy/help link gates from data4/inner.js_translated.js:5423-5488.

export default basicTest({
	name: "cf-inner-footer-terms-links-gates",
	js: `
    function s(key) {
      return ({ "challenge.privacy_link": "https://www.cloudflare.com/privacypolicy/", "turnstile_footer_privacy": "Privacy", "challenge.troubleshoot": "/cdn-cgi/challenge-platform/help", "turnstile_footer_help": "Help" })[key] || key;
    }
    function render(opt) {
      const qA = !opt.ofon9 || opt.LNNo7;
      const qi = !opt.ofon9 || opt.ncgO5;
      const qO = document.createElement("div");
      qO.id = "terms";
      if (qA) {
        const qF = document.createElement("a");
        qF.href = s("challenge.privacy_link");
        qF.rel = "noopener noreferrer";
        qF.id = "privacy-link";
        qF.target = "_blank";
        qF.textContent = s("turnstile_footer_privacy");
        qO.appendChild(qF);
      }
      if (qA && qi) {
        const spacer = document.createElement("span");
        spacer.className = "link-spacer";
        spacer.textContent = " • ";
        qO.appendChild(spacer);
      }
      if (qi) {
        const qp = document.createElement("a");
        qp.rel = "noopener noreferrer";
        qp.target = "_blank";
        qp.id = "help-link";
        qp.textContent = s("turnstile_footer_help");
        qp.href = s("challenge.troubleshoot");
        qO.appendChild(qp);
      }
      return { ids: [...qO.querySelectorAll("a")].map((a) => a.id), spacer: !!qO.querySelector(".link-spacer") };
    }

    const observed = { interactive: render({ ofon9: false }), managedPrivacyOnly: render({ ofon9: true, LNNo7: true, ncgO5: false }), managedHelpOnly: render({ ofon9: true, LNNo7: false, ncgO5: true }) };
    assert(observed.interactive.ids.join(",") === "privacy-link,help-link", "interactive footer should include privacy and help");
    assert(observed.managedPrivacyOnly.ids.join(",") === "privacy-link", "LNNo7 should gate privacy link");
    assert(observed.managedHelpOnly.ids.join(",") === "help-link", "ncgO5 should gate help link");
    assertConsistent("inner-footer-terms-links-gates", observed);
  `,
});

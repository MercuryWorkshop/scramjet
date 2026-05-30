import { basicTest } from "../../testcommon.ts";

// Ports fail troubleshoot branch from data4/inner.js_translated.js:5416-5417.

export default basicTest({
	name: "cf-inner-fail-troubleshoot-class-toggle",
	js: `
    function renderFail(opt) {
      const wrapper = document.createElement("div");
      const text = document.createElement("p");
      text.id = "fail-text";
      text.classList.add("error-message-lg");
      text.textContent = "Verification failed";
      wrapper.appendChild(text);
      if (opt.RjTFs3) {
        const a = document.createElement("a");
        a.id = "fr-fail-troubleshoot-link";
        a.href = "#refresh";
        wrapper.appendChild(a);
        text.classList.add("error-message-sm");
        text.classList.remove("error-message-lg");
      }
      return { classes: [...text.classList].sort(), hasLink: !!wrapper.querySelector("#fr-fail-troubleshoot-link") };
    }
    const observed = { withoutLink: renderFail({ RjTFs3: false }), withLink: renderFail({ RjTFs3: true }) };
    assert(observed.withLink.hasLink && observed.withLink.classes.includes("error-message-sm"), "RjTFs3 should add troubleshoot link and use small message class");
    assertConsistent("inner-fail-troubleshoot-class-toggle", observed);
  `,
});

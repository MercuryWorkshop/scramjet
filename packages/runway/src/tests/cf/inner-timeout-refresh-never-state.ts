import { basicTest } from "../../testcommon.ts";

// Negative timeout refresh branch from inner.js_translated.js:3803-3813:
// when _cf_chl_opt.LLKqf9 === "never", Turnstile hides #timeout-refresh-link
// via dI(), promotes #timeout-text via dM(), and displays the timeout state
// instead of posting a refreshRequest click handler.

export default basicTest({
	name: "cf-inner-timeout-refresh-never-state",
	js: `
    const root = document.createElement("div");
    root.innerHTML = '<a id="timeout-refresh-link"></a><div id="timeout-text" class="error-message-sm"></div><div id="timeout"></div>';
    document.body.appendChild(root);

    try {
      const b = { _cf_chl_opt: { xpbnF3: "runway-widget-timeout-never", LLKqf9: "never" } };
      const helperCalls = [];
      function Y() { return false; }
      function dh(id) { return root.querySelector("#" + id); }
      function dI(id) {
        helperCalls.push(["hide", id]);
        dh(id).style.display = "none";
        dh(id).style.visibility = "hidden";
      }
      function dM(id) {
        helperCalls.push(["promote", id]);
        dh(id).classList.remove("error-message-sm");
        dh(id).classList.add("error-message-lg");
      }
      function db(id, display) { helperCalls.push(["display", id, display]); dh(id).style.display = display; }

      if (!Y("turnstile-timeout-state")) {
        if (b._cf_chl_opt.LLKqf9 !== "never") {
          dh("timeout-refresh-link").addEventListener("click", function() { throw new Error("should not attach refresh handler"); });
        } else {
          dI("timeout-refresh-link");
          dM("timeout-text");
        }
        db("timeout", "grid");
      }

      const observed = {
        refreshDisplay: dh("timeout-refresh-link").style.display,
        refreshVisibility: dh("timeout-refresh-link").style.visibility,
        timeoutTextClass: dh("timeout-text").className,
        timeoutDisplay: dh("timeout").style.display,
        helperCalls,
      };

      assert(observed.refreshDisplay === "none" && observed.refreshVisibility === "hidden", "timeout refresh link should be visually hidden when policy is never");
      assert(observed.timeoutTextClass === "error-message-lg", "timeout text helper should promote error message class");
      assert(observed.timeoutDisplay === "grid", "timeout state should display as grid");
      assertConsistent("inner-timeout-refresh-never-state", observed);
    } finally {
      root.remove();
    }
  `,
});

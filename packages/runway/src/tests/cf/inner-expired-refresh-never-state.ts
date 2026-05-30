import { basicTest } from "../../testcommon.ts";

// Negative expired refresh branch from inner.js_translated.js:6393-6404:
// when _cf_chl_opt.fbcuL0 === "never", Turnstile promotes #expired-text via
// dM(), hides #expired-refresh-link via dI(), displays the expired state, and
// calls F().

export default basicTest({
	name: "cf-inner-expired-refresh-never-state",
	js: `
    const root = document.createElement("div");
    root.innerHTML = '<a id="expired-refresh-link"></a><div id="expired-text" class="error-message-sm"></div><div id="expired"></div>';
    document.body.appendChild(root);

    try {
      const b = { _cf_chl_opt: { xpbnF3: "runway-widget-expired-never", fbcuL0: "never" } };
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
      function F() { helperCalls.push(["F"]); }

      if (!Y("turnstile-expired-state")) {
        if (b._cf_chl_opt.fbcuL0 !== "never") {
          dh("expired-refresh-link").addEventListener("click", function() { throw new Error("should not attach refresh handler"); });
        } else {
          dM("expired-text");
          dI("expired-refresh-link");
        }
        db("expired", "grid");
        F();
      }

      const observed = {
        refreshDisplay: dh("expired-refresh-link").style.display,
        refreshVisibility: dh("expired-refresh-link").style.visibility,
        expiredTextClass: dh("expired-text").className,
        expiredDisplay: dh("expired").style.display,
        helperCalls,
      };

      assert(observed.refreshDisplay === "none" && observed.refreshVisibility === "hidden", "expired refresh link should be visually hidden when policy is never");
      assert(observed.expiredTextClass === "error-message-lg", "expired text helper should promote error message class");
      assert(observed.expiredDisplay === "grid", "expired state should display as grid");
      assert(observed.helperCalls.some((call) => call[0] === "F"), "expired branch should call F");
      assertConsistent("inner-expired-refresh-never-state", observed);
    } finally {
      root.remove();
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Ports success animation swap from data4/inner.js_translated.js:4489-4503.

export default basicTest({
	name: "cf-inner-success-animation-swap",
	js: `
    const root = document.createElement("div");
    root.innerHTML = '<svg id="success-pre-i"></svg><svg id="success-i" style="display:none"></svg>';
    document.body.appendChild(root);
    try {
      function db(id, display) { root.querySelector("#" + id).style.display = display; }
      function dv() {
        const W = root.querySelector("#success-pre-i");
        W && W.addEventListener("animationend", () => { W.style.display = "none"; db("success-i", "block"); });
      }
      dv();
      root.querySelector("#success-pre-i").dispatchEvent(new Event("animationend"));
      const observed = { preDisplay: root.querySelector("#success-pre-i").style.display, successDisplay: root.querySelector("#success-i").style.display };
      assert(observed.preDisplay === "none" && observed.successDisplay === "block", "animationend should swap success icons");
      assertConsistent("inner-success-animation-swap", observed);
    } finally {
      root.remove();
    }
  `,
});

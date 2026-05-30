import { basicTest } from "../../testcommon.ts";

// Ports d9() from data4/inner.js_translated.js:3229-3249.

export default basicTest({
	name: "cf-inner-spinner-unspun-hide-verifying",
	js: `
    const root = document.createElement("div");
    root.innerHTML = '<div id="verifying"><svg id="verifying-i"></svg></div>';
    document.body.appendChild(root);
    try {
      function dh(id) { return root.querySelector("#" + id); }
      function dI(id) { const n = dh(id); n.style.display = "none"; n.style.visibility = "hidden"; }
      function d9() { const W = dh("verifying-i"); W && W.classList.add("unspun"); dI("verifying"); }
      d9();
      const observed = { spinnerClass: dh("verifying-i").className.baseVal || dh("verifying-i").getAttribute("class"), display: dh("verifying").style.display, visibility: dh("verifying").style.visibility };
      assert(dh("verifying-i").classList.contains("unspun"), "d9 should mark spinner unspun");
      assert(observed.display === "none", "d9 should hide verifying container");
      assertConsistent("inner-spinner-unspun-hide-verifying", observed);
    } finally {
      root.remove();
    }
  `,
});

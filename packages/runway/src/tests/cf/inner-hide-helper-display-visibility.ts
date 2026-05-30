import { basicTest } from "../../testcommon.ts";

// Ports dI() hide helper from data4/inner.js_translated.js:6655-6673.

export default basicTest({
	name: "cf-inner-hide-helper-display-visibility",
	js: `
    const node = document.createElement("div");
    node.id = "runway-hide-helper";
    node.style.display = "grid";
    node.style.visibility = "visible";
    document.body.appendChild(node);
    try {
      function dh(id) { return document.getElementById(id); }
      function dI(id) {
        const target = dh(id);
        if (!target) return;
        target.style.display = "none";
        target.style.visibility = "hidden";
      }
      dI("runway-hide-helper");
      const observed = { display: node.style.display, visibility: node.style.visibility };
      assert(observed.display === "none" && observed.visibility === "hidden", "dI should hide display and visibility");
      assertConsistent("inner-hide-helper-display-visibility", observed);
    } finally {
      node.remove();
    }
  `,
});

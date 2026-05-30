import { basicTest } from "../../testcommon.ts";

// Ports db() display helper from data4/inner.js_translated.js:7479-7485.

export default basicTest({
	name: "cf-inner-display-helper-visible",
	js: `
    const node = document.createElement("div");
    node.id = "runway-display-helper";
    node.style.visibility = "hidden";
    document.body.appendChild(node);
    try {
      function dh(id) { return document.getElementById(id); }
      function db(W, T) {
        T = T || "block";
        const Z = dh(W);
        if (!Z) return;
        Z.style.display = T;
        Z.style.visibility = "visible";
      }
      db("runway-display-helper", "grid");
      const observed = { display: node.style.display, visibility: node.style.visibility };
      assert(observed.display === "grid" && observed.visibility === "visible", "db should set display and visibility");
      assertConsistent("inner-display-helper-visible", observed);
    } finally {
      node.remove();
    }
  `,
});

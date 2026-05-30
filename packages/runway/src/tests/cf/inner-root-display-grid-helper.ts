import { basicTest } from "../../testcommon.ts";

// Ports d6() from data4/inner.js_translated.js:6937-6947.

export default basicTest({
	name: "cf-inner-root-display-grid-helper",
	js: `
    const root = document.createElement("div");
    document.body.appendChild(root);
    try {
      function d4() { return root; }
      function d6() { const q = d4(); q ? q.style.display = "grid" : null; }
      d6();
      const observed = { display: root.style.display };
      assert(observed.display === "grid", "d6 should set root display grid");
      assertConsistent("inner-root-display-grid-helper", observed);
    } finally { root.remove(); }
  `,
});

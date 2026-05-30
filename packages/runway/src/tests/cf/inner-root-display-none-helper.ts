import { basicTest } from "../../testcommon.ts";

// Ports d7() from data4/inner.js_translated.js:7262-7276.

export default basicTest({
	name: "cf-inner-root-display-none-helper",
	js: `
    const root = document.createElement("div");
    root.style.display = "grid";
    document.body.appendChild(root);
    try {
      function d4() { return root; }
      function d7() { const f = d4(); f ? f.style.display = "none" : null; }
      d7();
      const observed = { display: root.style.display };
      assert(observed.display === "none", "d7 should hide root display");
      assertConsistent("inner-root-display-none-helper", observed);
    } finally { root.remove(); }
  `,
});

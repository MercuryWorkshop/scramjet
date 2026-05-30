import { basicTest } from "../../testcommon.ts";

// Ports d5 root text clearing from data4/inner.js_translated.js:4076-4089.

export default basicTest({
	name: "cf-inner-root-text-clear-helper",
	js: `
    const root = document.createElement("div");
    root.id = "runway-clear-root";
    root.textContent = "stale text";
    document.body.appendChild(root);
    const calls = [];

    try {
      function d4() { return document.getElementById("runway-clear-root"); }
      function sTuu5(q) { calls.push(q); }
      function d5() {
        const W = d4();
        W ? W.textContent = "" : sTuu5("missing-root");
      }

      d5();
      const observed = { text: root.textContent, calls };
      assert(root.textContent === "", "d5 should clear root textContent");
      assertConsistent("inner-root-text-clear-helper", observed);
    } finally {
      root.remove();
    }
  `,
});

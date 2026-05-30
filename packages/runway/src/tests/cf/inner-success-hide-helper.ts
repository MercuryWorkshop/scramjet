import { basicTest } from "../../testcommon.ts";

// Ports dC() from data4/inner.js_translated.js:7486-7492.

export default basicTest({
	name: "cf-inner-success-hide-helper",
	js: `
    const success = document.createElement("div");
    success.id = "success";
    document.body.appendChild(success);
    try {
      function dI(id) { document.getElementById(id).style.display = "none"; }
      function dC() { dI("success"); }
      dC();
      const observed = { display: success.style.display };
      assert(observed.display === "none", "dC should hide success state");
      assertConsistent("inner-success-hide-helper", observed);
    } finally { success.remove(); }
  `,
});

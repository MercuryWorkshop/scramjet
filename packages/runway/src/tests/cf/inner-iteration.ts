import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_3775_91 / vm_func_3835_5 / vm_func_3768_139:
//   1. reg_32 length gate
//   2. reg_25 = String(reg_32[i])
//   3. reg_27 length gate
//   4. reg_22 = reg_25 + "."
//   5. (repeat for reg_32[1])
//
// vm_func_3913_49 / vm_func_4008_73 / vm_func_1757_197 / vm_func_1873_231:
//   1. window.xHzMd3 = "hdAcE0"
//   2. window.oIvGL6.NLAs4("sharknado")
//   3. If BroadcastChannel exists -> window.xHzMd3 = "acou0"

export default basicTest({
  name: "cf-inner-iteration",
  js: `
    const reg32 = ["alpha", "beta"];
    const reg27 = ["theta"];

    // vm_func_3775_91
    let reg25 = String(reg32[0]);
    let reg22 = reg25 + ".";
    assert(reg22 === "alpha.", "reg22 should be alpha.");

    // vm_func_3768_139 -> vm_func_3835_5
    reg25 = String(reg32[1]);
    reg22 = reg25 + ".";
    assert(reg22 === "beta.", "reg22 should be beta.");

    // vm_func_4008_73 + vm_func_1757_197 + vm_func_1873_231
    const prevX = window.xHzMd3;
    const prevO = window.oIvGL6;
    window.xHzMd3 = "hdAcE0";
    window.oIvGL6 = { NLAs4: () => {} };
    window.oIvGL6.NLAs4("sharknado");
    if (typeof BroadcastChannel !== "undefined") {
      window.xHzMd3 = "acou0";
    }
    assert(window.xHzMd3 === "acou0" || typeof BroadcastChannel === "undefined",
      "xHzMd3 should be set for BroadcastChannel path");

    if (prevX === undefined) delete window.xHzMd3; else window.xHzMd3 = prevX;
    if (prevO === undefined) delete window.oIvGL6; else window.oIvGL6 = prevO;
  `,
});

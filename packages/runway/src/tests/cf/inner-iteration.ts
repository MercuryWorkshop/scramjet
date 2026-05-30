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
// vm_func_3913_49 calls vm_func_4008_73[vm_func_1757_197](), which is covered
// more directly in broadcast-channel.ts. This file keeps the reg_32/reg_27
// iteration behavior separate from that side-effect chain.

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

    assertConsistent("inner-iteration-prefixes", ["alpha.", "beta."]);
  `,
});

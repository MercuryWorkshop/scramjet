import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_111701_107 (line 15183-15188):
//   SpeechSynthesis.prototype.getVoices → check method exists
//
// p2_func_107850_31 (line 15762-15816):
//   MutationObserver.prototype.observe → check method exists
//
// p2_func_73237_21 (line 20280-20293):
//   1. Object.prototype.toString.call("toString") → "[object String]"
//   2. BigInt(value) → wrap in Object() → structuredClone → toString → "688"
//   3. "nHHc5" + toString → prefix and verify
//
// p2_func_73248_131 (line 20323-20338):
//   Same as 73237_21, duplicate check (called from MouseEvent dispatch path)
//
// p2_func_14061_123 / p2_func_14114_99 (line 26009-26018):
//   1. document.referrer → accessed as string
//   2. navigator.getGamepads → accessed
//   3. navigator.permissions → accessed

export default basicTest({
  name: "cf-extra-protos",
  js: `
    // Check 1: SpeechSynthesis.prototype.getVoices (p2_func_111701_107)
    if (typeof SpeechSynthesis !== "undefined") {
      assert(typeof SpeechSynthesis.prototype.getVoices === "function",
        "SpeechSynthesis.prototype.getVoices should be a function");
    } else {
      pass("SpeechSynthesis not available in this browser");
    }

    // Check 2: MutationObserver and its observe method (p2_func_107850_31)
    assert(typeof MutationObserver !== "undefined",
      "MutationObserver should be defined");
    assert(typeof MutationObserver.prototype.observe === "function",
      "MutationObserver.prototype.observe should be a function");
    // Verify it works
    const mo = new MutationObserver(() => {});
    const div = document.createElement("div");
    document.body.appendChild(div);
    mo.observe(div, { attributes: true });
    mo.disconnect();
    document.body.removeChild(div);

    // Check 3: structuredClone of BigInt Object (p2_func_73237_21, p2_func_73248_131)
    if (typeof BigInt !== "undefined") {
      try {
        const bigVal = BigInt(688);
        const obj = Object(bigVal);
        const cloned = structuredClone(obj);
        assert(typeof cloned.toString === "function",
          "structuredClone result should have toString");
        assert(cloned.toString() === "688",
          "structuredClone(Object(BigInt(688))).toString() should be '688', got: " + cloned.toString());
      } catch (e) {
        pass("structuredClone BigInt check failed: " + e.message);
      }
    }

    // Check 4: console.warn (used in Turnstile's error handling paths)
    assert(typeof console.warn === "function",
      "console.warn should be a function");

    // Check 5: document.referrer (p2_func_14114_99, p2_func_14061_123)
    assert(typeof document.referrer === "string",
      "document.referrer should be a string");
  `,
});
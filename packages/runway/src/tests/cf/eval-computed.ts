import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_64834_39 (line 20085-20108): eval(zjVu3(...)) array coercion
//   Creates Array(16), joins with eval call, tests toString coercion
//
// p2_func_68818_109 (line 20495-20512):
//   1. eval(zjVu3("typeof pyimport")) → "undefined" in browser
//   2. eval(zjVu3("(function(){return this}.call(1)) !== ...")) → strict-mode this binding
//
// p2_func_68754_13 (line 20705-20728):
//   1. Same as above + process.env stringify check
//
// p2_func_68127_87 (line 20774-20807) / p2_func_68119_195 (line 20820-20854):
//   1. navigator.prototype getOwnPropertyDescriptor("plugins") → getter.toString()
//   2. JSON.stringify(getter.toString()) → string
//   3. .charCodeAt(2) → numeric code
//   4. eval(zjVu3("typeof module"))
//   5. eval(zjVu3("typeof global"))

export default basicTest({
  name: "cf-eval-computed",
  js: `
    // Check 1: eval("typeof pyimport") should be "undefined" (p2_func_68818_109)
    // Pyodide marker — confirms this isn't a Python WASM environment
    const typeofPyimport = eval("typeof pyimport");
    assert(typeofPyimport === "undefined",
      "eval('typeof pyimport') should be 'undefined', got: " + typeofPyimport);

    // Check 2: eval("typeof module") should be "undefined"
    const typeofModule = eval("typeof module");
    assert(typeofModule === "undefined",
      "eval('typeof module') should be 'undefined', got: " + typeofModule);

    // Check 3: eval("typeof global") should be "undefined"
    const typeofGlobal = eval("typeof global");
    assert(typeofGlobal === "undefined",
      "eval('typeof global') should be 'undefined', got: " + typeofGlobal);

    // Check 4: eval("typeof process") should be "undefined" (p2_func_68754_13)
    try {
      const typeofProcess = eval("typeof process");
      assert(typeofProcess === "undefined",
        "eval('typeof process') should be 'undefined', got: " + typeofProcess);
    } catch (_) {}

    // Check 5: strict-mode this binding check (p2_func_68818_109)
    // (function(){return this})() returns window (sloppy) or undefined (strict)
    const sloppyThis = eval("(function(){return this})()");
    assert(sloppyThis === window || sloppyThis === globalThis,
      "sloppy IIFE should return globalThis");

    // Check 6: Array(16) constructor integrity (p2_func_64834_39)
    const arr = new Array(16);
    assert(arr.length === 16,
      "new Array(16) should have length 16, got: " + arr.length);

    // Check 7: JSON.stringify(getter.toString()) + charCodeAt (p2_func_68127_87)
    if (navigator.plugins !== undefined) {
      const navProto = Object.getPrototypeOf(navigator);
      const pluginsDesc = Object.getOwnPropertyDescriptor(navProto, "plugins");
      if (pluginsDesc && pluginsDesc.get) {
        const getterStr = pluginsDesc.get.toString();
        const jsonStr = JSON.stringify(getterStr);
        assert(typeof jsonStr === "string",
          "JSON.stringify(getter toString) should return string");
        assert(jsonStr.length > 0,
          "JSON.stringify should produce non-empty result");
        // charCodeAt(2) — Turnstile gets a specific byte for fingerprinting
        assert(typeof jsonStr.charCodeAt(2) === "number",
          "JSON.charAt(2).charCodeAt should be a number");
      }
    }

    // Check 8: Array coercion test with toString side-effect (p2_func_64834_39)
    const coercionObj = { i: 1, toString() { return this.i++; } };
    const coerced = "" + coercionObj;
    assert(coerced === "1",
      "Object with custom toString should coerce, got: " + coerced);

    // Check 9: typeof process.env
    try {
      const procEnvType = eval("typeof process !== 'undefined' ? typeof process.env : 'no-process'");
      assert(procEnvType === "undefined" || procEnvType === "no-process",
        "process.env should not exist in browser");
    } catch (_) {}
  `,
});
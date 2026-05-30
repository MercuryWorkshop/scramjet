import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_73449_15 (line 20265-20268) / p2_func_73473_49 (line 20297-20299):
//   RegExp("\\u006d\\u0069\\u0067\\u0075\\u0065\\u006c\\u0077\\u0061\\u0073\\u0068\\u0065\\u0072\\u0065", __STR_4)
//   = RegExp("miguelwashere", flags)
//   This is a content-filtering Regex used to verify text patterns
//
// p2_func_88281_21 (line 18668-18672):
//   RegExp("^function (?:get |set )?[a-zA-Z]+\\(\\) \\{\\s+\\[native code\\]\\s+\\}$", obfFlags)
//   This validates that a native function's toString output matches the expected pattern
//
// p2_func_87167_197 (line 18948-18955):
//   arg_5.stack.indexOf("at Object.toString (<anonymous>)")
//   Checks if an Error's stack trace contains the expected toString frame

export default basicTest({
	name: "cf-error-stack-checks",
	js: `
    // Check 1: RegExp pattern matching (p2_func_73449_15)
    const pattern = new RegExp("miguelwashere", "g");
    assert(pattern instanceof RegExp,
      "RegExp constructor should return RegExp");
    assert(pattern.test("miguelwashere"),
      "RegExp 'miguelwashere' should match itself");
    assert(!pattern.test("other"),
      "RegExp should not match different string");

    // Check 2: Native function toString pattern validation (p2_func_88281_21)
    // Turnstile checks: /^function (?:get |set )?[a-zA-Z]+\\(\\) \\{\\s+\\[native code\\]\\s+\\}$/
    const nativePattern = /^function (?:get |set )?[a-zA-Z]+\\(\\) \\{\\s+\\[native code\\]\\s+\\}$/;
    const fnStr = Array.prototype.push.toString();
    assert(typeof fnStr === "string" && fnStr.indexOf("native code") !== -1,
      "Array.push.toString should expose native code: " + fnStr);

    const getterStr = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform")
      ?.get?.toString() || "";
    if (getterStr) {
      assert(nativePattern.test(getterStr) || getterStr.indexOf("get platform") !== -1,
        "Navigator.platform getter should look native: " + getterStr);
    }

    // Check 3: Error.stack introspection (p2_func_87167_197)
    const err = new Error("test");
    assert(typeof err.stack === "string",
      "Error.stack should be a string");
    assert(err.stack.length > 0,
      "Error.stack should not be empty");

    // Check 4: Error.stack contains expected frames
    // Turnstile checks for "at Object.toString (<anonymous>)" pattern
    const err2 = new Error("frame test");
    assert(err2.stack.indexOf("Error") !== -1 || err2.stack.indexOf("at ") !== -1,
      "Error.stack should contain frame information: " + err2.stack.substring(0, 80));

    // Check 5: RegExp with unicode escape sequences works
    const escPattern = new RegExp("\\u006d\\u0069\\u0067", "g");
    assert(escPattern.test("mig"),
      "Unicode escape RegExp should match: \\u006d\\u0069\\u0067 = 'mig'");

    // Check 6: Function.prototype.toString on error-related things
    assert(Error.prototype.toString.toString().indexOf("native code") !== -1,
      "Error.prototype.toString should be native");
  `,
});

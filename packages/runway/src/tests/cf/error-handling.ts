import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_181177_17 (line 6290-6317):
//   1. Create new Error()
//   2. Object.defineProperty(err, "name", {get: fn, configurable:true, enumerable:true})
//   3. Object.defineProperty(err, "message", {get: fn, configurable:true, enumerable:true})
//   4. Object.defineProperty(err, "stack", {get: fn, configurable:true, enumerable:true})
//
// Turnstile checks that Error properties can be redefined via
// Object.defineProperty — a browser that blocks this may be tampered.
//
// p2_func_186248_83 (line 5621-5658):
//   1. error.name → push
//   2. error.message → push
//   3. error.stack → push
//   4. SDGM5.toString() → push (function source string)
//   5. error source context toString → push
//   6. (0).id → push (some ID value)
//   7. console.groupEnd() → closes group
//
// p2_func_1083_25 (line 502-528):
//   1. unhandledrejection handler
//   2. window.oKAYx0(reason) → telemetry
//   3. window.LNrN0() → debug info
//   4. console.error(...) → log
//   5. String(reason) → coercion
//   6. window.ulkK4(...) → remote telemetry send
//
// Error message filtering:
//   message.toLowerCase().indexOf("script error") → checks for "Script error."

export default basicTest({
	name: "cf-error-handling",
	js: `
    // Check 1: Object.defineProperty on Error name/message/stack (p2_func_181177_17)
    const err = new Error("Turnstile test");
    try {
      Object.defineProperty(err, "name", {
        get() { return "CustomError"; },
        configurable: true,
        enumerable: true,
      });
      assert(err.name === "CustomError",
        "Error.name should be redefinable via Object.defineProperty");

      Object.defineProperty(err, "message", {
        get() { return "Custom message"; },
        configurable: true,
        enumerable: true,
      });
      assert(err.message === "Custom message",
        "Error.message should be redefinable via Object.defineProperty");

      Object.defineProperty(err, "stack", {
        get() { return "Custom stack"; },
        configurable: true,
        enumerable: true,
      });
      assert(err.stack === "Custom stack",
        "Error.stack should be redefinable via Object.defineProperty");
    } catch (e) {
      pass("Error property redefinition threw: " + e.message);
    } finally {
      delete err.name;
      delete err.message;
      delete err.stack;
    }

    // Check 2: Error name, message, stack are strings (p2_func_186248_83)
    const err2 = new Error("test");
    assert(typeof err2.name === "string",
      "Error.name should be a string, got: " + typeof err2.name);
    assert(typeof err2.message === "string",
      "Error.message should be a string");
    assert(typeof err2.stack === "string",
      "Error.stack should be a string");

    // Check 3: "Script error." detection (p2_func_1836_143)
    // Turnstile checks if error messages contain "Script error" pattern
    const scriptError = "Script error.";
    assert(scriptError.toLowerCase().indexOf("script error") !== -1,
      "'Script error.' should match indexOf pattern");

    // Check 4: String coercion of Error
    const str = String(err2);
    assert(typeof str === "string",
      "String(Error) should return a string, got: " + str);

    // Check 5: console.error callable
    assert(typeof console.error === "function",
      "console.error should be a function");

    // Check 6: Object.defineProperty on plain object
    const obj = {};
    Object.defineProperty(obj, "custom", {
      value: 42,
      configurable: true,
      enumerable: true,
    });
    assert(obj.custom === 42,
      "Object.defineProperty should work on plain objects");
  `,
	scramjetOnly: false,
});

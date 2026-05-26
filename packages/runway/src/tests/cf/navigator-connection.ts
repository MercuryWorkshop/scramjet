import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_171982_13 (line 7111-7118):
//   1. navigator.connection → check existence
//   2. if connection exists → p2_func_172062_121
//
// p2_func_172062_121 (line 7119+):
//   1. navigator.connection.effectiveType → read connection type
//
// p2_func_172143_43 (line 7152-7164):
//   1. navigator.connection.effectiveType → store as "lMyGu8"
//   2. navigator.onLine → check online status
//
// p2_func_172199_181 (line 7125-7132):
//   1. navigator.onLine → check online status
//   2. typeof onLine → verify it's not "unknown"
//   3. if typeof is truthy → p2_func_172283_5
//
// p2_func_172283_5 (line 7141-7148):
//   1. String(navigator.onLine) → convert to "true"/"false" string
//   2. Store result
//
// p2_func_131156_175 (line 11920-11930):
//   1. getOwnPropertyDescriptor(Navigator.prototype, "connection")
//   2. Check descriptor exists, getter is function, toString valid
//
// p2_func_133204_39 (line 11336-11346):
//   1. getOwnPropertyDescriptor(Navigator.prototype, "language")

export default basicTest({
  name: "cf-navigator-connection",
  js: `
    // Check 1: navigator.onLine (p2_func_172199_181, p2_func_172283_5)
    assert(typeof navigator.onLine === "boolean",
      "navigator.onLine should be a boolean");
    // Turnstile does String(navigator.onLine) to convert to "true"/"false"
    const onLineStr = String(navigator.onLine);
    assert(onLineStr === "true" || onLineStr === "false",
      "String(navigator.onLine) should be 'true' or 'false', got: " + onLineStr);

    // Check 2: navigator.connection descriptor (p2_func_131156_175)
    const connDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "connection");
    assert(connDesc !== undefined,
      "Navigator.prototype.connection should have a descriptor");
    if (connDesc) {
      assert(typeof connDesc.get === "function",
        "Navigator.prototype.connection should have a function getter");
      assert(connDesc.get.toString().indexOf("get connection") !== -1,
        "connection getter should toString as 'get connection'");
    }

    // Check 3: navigator.connection.effectiveType (p2_func_172062_121)
    if (navigator.connection) {
      assert(typeof navigator.connection.effectiveType === "string",
        "navigator.connection.effectiveType should be a string");
      // Turnstile stores effectiveType as "lMyGu8" in results
    }

    // Check 4: navigator.language descriptor (p2_func_133204_39)
    const langDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "language");
    assert(langDesc !== undefined,
      "Navigator.prototype.language should have a descriptor");
    if (langDesc) {
      assert(typeof langDesc.get === "function",
        "Navigator.prototype.language should have a function getter");
      assert(langDesc.get.toString().indexOf("get language") !== -1,
        "language getter should toString as 'get language'");
    }

    // Check 5: navigator.platform is a string (collected in worker postMessage)
    assert(typeof navigator.platform === "string",
      "navigator.platform should be a string for value collection");
  `,
});
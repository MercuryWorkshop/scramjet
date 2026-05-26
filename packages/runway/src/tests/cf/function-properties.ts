import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_86159_111 (line 19044-19056):
//   1. Object.getOwnPropertyNames(SDGM5) → enumerate ALL own properties of a function
//   2. .sort() → sort alphabetically
//   3. .toString() → convert sorted array of prop names to comma-separated string
//
// This is DIFFERENT from the individual descriptor checks — this enumerates
// EVERY own property of the function object and produces a sorted string.
// The result is compared against expected values to detect tampering.
//
// Turnstile expects:
//   - "arguments" and "length" as own props (for non-strict functions)
//   - "name" (on named functions)
//   - "prototype" (on constructors)
//   - "caller" (non-strict only)
//
// p2_func_20026_251 (line 25175):
//   element.contains(child) — checks DOM containment
//   → branches to location/history test chain (p2_func_20062_85 etc)

export default basicTest({
  name: "cf-function-properties",
  js: `
    // Check 1: Object.getOwnPropertyNames on a function (p2_func_86159_111)
    // Turnstile enumerates all own properties of a function, sorts them,
    // and calls .toString() to get a string representation
    function testFn() {}
    testFn.customProp = 42; // Add a custom property to test enumeration

    const props = Object.getOwnPropertyNames(testFn);
    assert(Array.isArray(props),
      "Object.getOwnPropertyNames should return an array");
    assert(props.length >= 2,
      "Function should have at least 'length' and 'name' as own properties");

    // Check 2: Sorted property names (p2_func_86159_111)
    const sorted = props.sort();
    const propString = sorted.toString();
    assert(typeof propString === "string",
      "Sorted properties .toString() should be a string");

    // Check 3: Essential function properties should be present
    assert(props.indexOf("length") !== -1,
      "Function should have 'length' own property");
    assert(props.indexOf("name") !== -1,
      "Function should have 'name' own property");
    assert(props.indexOf("prototype") !== -1,
      "Function should have 'prototype' own property");

    // Check 4: Built-in functions (non-constructor) should NOT have prototype
    const nativeFn = Array.prototype.push;
    const nativeProps = Object.getOwnPropertyNames(nativeFn);
    assert(nativeProps.indexOf("length") !== -1,
      "Array.prototype.push should have 'length'");
    assert(nativeProps.indexOf("name") !== -1,
      "Array.prototype.push should have 'name'");
    // Built-in prototype methods don't have their own "prototype" property
    // (it's on the constructor, not the method)

    // Check 5: Callable objects without "prototype"
    const arrowFn = () => {};
    const arrowProps = Object.getOwnPropertyNames(arrowFn);
    assert(arrowProps.indexOf("prototype") === -1,
      "Arrow function should NOT have 'prototype' own property");
    assert(arrowProps.indexOf("length") !== -1,
      "Arrow function should have 'length'");
    assert(arrowProps.indexOf("name") !== -1,
      "Arrow function should have 'name'");
  `,
});
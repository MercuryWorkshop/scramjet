import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_247606_125 (line 1244-1261):
//   1. Date.now() → current timestamp → stored as YLYw5
//   2. Challenge metadata string stored
//
// p2_func_236024_95 (line 1316-1334):
//   1. Read stored timestamp (arg_0[0].YLYw5)
//   2. Date.now() → new timestamp
//   3. Delta = newTimestamp - storedTimestamp → stored as timing metric
//
// p2_func_54249_57 (line 21486-21491):
//   1. window.performance → check existence
//
// p2_func_54510_31 (line 21527-21533):
//   1. window.performance
//   2. performance.getEntries() → get all performance entries
//
// p2_func_17885_111 (line 25452-25464):
//   1. window.performance.memory → get memory info
//   2. Object.getPrototypeOf(memory) → get prototype
//   3. Object.getOwnPropertyNames(proto) → enumerate memory keys
//   4. proto.length → number of properties
//
// Performance.prototype.now check (line 15352-15356):
//   1. window.Performance.prototype.now → check method exists
//
// p2_func_218520_111 (line 1809-1813):
//   1. window.performance.getEntriesByType("navigation")

export default basicTest({
  name: "cf-performance",
  js: `
    // Check 1: Performance.prototype.now (line 15352 check)
    if (typeof Performance !== "undefined") {
      assert(typeof Performance.prototype.now === "function",
        "Performance.prototype.now should be a function");
    }

    // Check 2: performance object exists (p2_func_54249_57)
    assert(typeof performance === "object" && performance !== null,
      "performance should be an object");

    // Check 3: performance.now() returns a number (p2_func_247606_125)
    assert(typeof performance.now === "function",
      "performance.now should be a function");
    const t1 = performance.now();
    assert(typeof t1 === "number",
      "performance.now() should return a number");

    // Check 4: timing delta (p2_func_236024_95)
    const t2 = performance.now();
    const delta = t2 - t1;
    assert(typeof delta === "number",
      "performance.now() delta should be a number");
    assert(delta >= 0,
      "performance.now() should be monotonically increasing, delta: " + delta);

    // Check 5: performance.getEntries (p2_func_54510_31)
    const entries = performance.getEntries();
    assert(Array.isArray(entries),
      "performance.getEntries() should return an array");

    // Check 6: performance.getEntriesByType("navigation") (p2_func_218520_111)
    if (typeof performance.getEntriesByType === "function") {
      const navEntries = performance.getEntriesByType("navigation");
      assert(Array.isArray(navEntries),
        "performance.getEntriesByType('navigation') should return an array");
    }

    // Check 7: performance.memory prototype enumeration (p2_func_17885_111)
    if (performance.memory) {
      assert(typeof performance.memory === "object",
        "performance.memory should be an object");
      const proto = Object.getPrototypeOf(performance.memory);
      assert(proto !== null,
        "performance.memory prototype should not be null");
      const keys = Object.getOwnPropertyNames(proto);
      assert(Array.isArray(keys),
        "performance.memory prototype keys should be an array");
    }

    // Check 8: Date.now() works (used by Turnstile timing)
    const dn = Date.now();
    assert(typeof dn === "number",
      "Date.now() should return a number");
    assert(dn > 0,
      "Date.now() should return positive value");
  `,
});
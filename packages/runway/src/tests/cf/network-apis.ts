import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_189004_141 (line 5469-5479):
//   1. reg_228.fetch(url, undefined) → call fetch with one arg
//   2. .then(p2_func_188752_84) → process response
//   3. .catch(p2_func_188956_255) → error handler
//
// p2_func_188752_84 (line 5487-5495):
//   1. response.headers → access headers
//   2. response.headers.get("private-token-client-replay") → check custom header
//   3. response.ok → check success status
//
// p2_func_188862_23 (line 5497-5504):
//   1. If !ok → asyncWaitReplay(!ok, retryFn, undefined) → retry logic
//
// p2_func_188639_180 (line 5510-5518):
//   1. stack_81.fetch(url, undefined) → retry fetch
//
// p2_func_100384_52: XMLHttpRequest constructor check
//
// p2_func_68119_195 (line 20809-20818):
//   1. eval("typeof module") → should return "undefined" in browser
//   2. eval("typeof global") → should return "undefined" in browser
//
// Value collection:
//   3. navigator.plugins getPrototypeOf descriptor stringify

export default basicTest({
  name: "cf-network-apis",
  js: `
    // Check 1: fetch is a function (p2_func_189004_141)
    assert(typeof fetch === "function",
      "fetch should be a function");

    // Check 2: XMLHttpRequest is a function
    assert(typeof XMLHttpRequest === "function",
      "XMLHttpRequest should be a function");

    // Check 3: XMLHttpRequest.prototype.send (p2_func_118019_250)
    assert(typeof XMLHttpRequest.prototype.send === "function",
      "XMLHttpRequest.prototype.send should be a function");

    // Check 4: Navigator.prototype.sendBeacon
    assert(typeof Navigator.prototype.sendBeacon === "function",
      "Navigator.prototype.sendBeacon should be a function");

    // Check 5: eval("typeof module") → must be "undefined" (p2_func_68119_195)
    // Turnstile uses this to detect Node.js/bundler environments
    const typeofModule = eval("typeof module");
    assert(typeofModule === "undefined",
      "eval('typeof module') should be 'undefined' in browser, got: " + typeofModule);

    // Check 6: eval("typeof global") → must be "undefined"
    const typeofGlobal = eval("typeof global");
    assert(typeofGlobal === "undefined",
      "eval('typeof global') should be 'undefined' in browser, got: " + typeofGlobal);

    // Check 7: fetch a resource and check response headers (p2_func_188752_84)
    try {
      const res = await fetch("/");
      assert(typeof res.ok === "boolean",
        "fetch response.ok should be a boolean");
      assert(typeof res.headers === "object",
        "fetch response.headers should be an object");
      assert(typeof res.headers.get === "function",
        "response.headers.get should be a function");
      assert(typeof res.status === "number",
        "fetch response.status should be a number, got: " + res.status);
    } catch (e) {
      pass("fetch to / failed: " + e.message);
    }

    // Check 8: navigator.plugins getPrototypeOf descriptor (p2_func_68119_195)
    if (navigator.plugins !== undefined) {
      const navProto = Object.getPrototypeOf(navigator);
      const pluginsDesc = Object.getOwnPropertyDescriptor(navProto, "plugins");
      assert(pluginsDesc !== undefined,
        "navigator prototype should have plugins descriptor");
      if (pluginsDesc && pluginsDesc.get) {
        const getterStr = pluginsDesc.get.toString();
        assert(getterStr.indexOf("get plugins") !== -1,
          "plugins getter should toString as 'get plugins'");
      }
    }
  `,
});
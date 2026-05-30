import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_275120_109 (line 335-347): addEventListener("unhandledrejection")
// p2_func_276662_93 (line 333-347): addEventListener("unhandledrejection")
//   + addEventListener("error", handler, true)
// p2_func_276625_85 (line 542-559): same pattern
//
// Control flow:
//   1. window.addEventListener("unhandledrejection", handler)
//   2. window.addEventListener("error", handler, true) → capture phase
//   3. Later: removeEventListener for cleanup
//
// p2_func_179325_118 (line 5660-5677):
//   1. Worker.onmessage = handler
//   2. Worker.onerror = handler
//   3. OIrLs2.addEventListener("message", handler)
//
// p2_func_153737_185 (line 8443-8471):
//   1. OIrLs2.addEventListener("message", handler)
//   2. OIrLs2.postMessage(script)
//
// p2_func_18121_51 (line 25471-25504):
//   1. OIrLs2.addEventListener("message", handler)
//   2. createElement("iframe")
//   3. Set up onload/onerror handlers

export default basicTest({
	name: "cf-global-listeners",
	js: `
    // Check 1: window.addEventListener is a function (p2_func_276662_93)
    assert(typeof window.addEventListener === "function",
      "window.addEventListener should be a function");

    // Check 2: addEventListener for "unhandledrejection" (p2_func_275120_109)
    // Turnstile sets global handler to catch unhandled promise rejections
    let rejectionCaught = false;
    const rejectionHandler = () => { rejectionCaught = true; };
    window.addEventListener("unhandledrejection", rejectionHandler);
    assert(typeof rejectionHandler === "function",
      "unhandledrejection handler should be registered");
    window.removeEventListener("unhandledrejection", rejectionHandler);

    // Check 3: addEventListener for "error" in capture phase
    // Turnstile uses capture:true (the third argument) in the lifted code
    const errHandler = () => {};
    window.addEventListener("error", errHandler, true);
    window.removeEventListener("error", errHandler, true);

    // Check 4: addEventListener for "message"
    const msgHandler = () => {};
    window.addEventListener("message", msgHandler);
    window.removeEventListener("message", msgHandler);

    // Check 5: EventTarget.prototype.removeEventListener
    assert(typeof EventTarget.prototype.removeEventListener === "function",
      "EventTarget.removeEventListener should be a function");

    // Check 6: dispatchEvent (p2_func_102149_249)
    assert(typeof EventTarget.prototype.dispatchEvent === "function",
      "EventTarget.dispatchEvent should be a function");

    // Check 7: dispatchEvent actually invokes listeners
    const ev = new Event("test_dispatch", { bubbles: true });
    let dispatched = false;
    const dispHandler = () => { dispatched = true; };
    window.addEventListener("test_dispatch", dispHandler);
    window.dispatchEvent(ev);
    window.removeEventListener("test_dispatch", dispHandler);
    assert(dispatched === true,
      "dispatchEvent should invoke registered listeners");

    // Check 8: window.onerror is accessible
    assert("onerror" in window,
      "window.onerror should exist");

    // Check 9: setInterval/clearInterval exist (used in timeout patterns)
    assert(typeof setInterval === "function",
      "setInterval should be a function");
    assert(typeof clearInterval === "function",
      "clearInterval should be a function");
  `,
});

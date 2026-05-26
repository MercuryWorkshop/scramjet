import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_2210_8 / vm_func_3276_239 (lines 66-117 / 191-252):
//   Turnstile collects Document/Element.prototype.querySelector/querySelectorAll
//   into an array, then wraps EACH with new Proxy(nativeFn, {apply: tracker}).
//   The Proxy handler (vm_func_936_25) pushes String(args[0]) into BPOu4.
//
// This verifies:
//   a. querySelector/querySelectorAll are native functions on prototypes
//   b. They can be wrapped with Proxy
//   c. The Proxy handler's apply trap fires correctly

export default basicTest({
  name: "cf-queryselector-proxy",
  js: `
    const results = [
      Document.prototype.querySelector,
      Document.prototype.querySelectorAll,
      Element.prototype.querySelector,
      Element.prototype.querySelectorAll,
    ];

    for (let i = 0; i < results.length; i++) {
      assert(typeof results[i] === "function",
        "querySelector[" + i + "] should be function");
      const fnStr = results[i].toString();
      assert(fnStr.indexOf("native code") !== -1 || fnStr.indexOf("[native code]") !== -1,
        "querySelector[" + i + "] should show native code: " + fnStr.substring(0, 50));
    }

    const tracker = [];
    const handler = {
      apply(target, that, args) {
        if (args.length > 0) tracker.push(String(args[0]));
        return Reflect.apply(target, that, args);
      },
    };

    // Wrap Document.querySelector with Proxy (just like Turnstile)
    const origQS = Document.prototype.querySelector;
    Object.defineProperty(Document.prototype, "querySelector", {
      value: new Proxy(origQS, handler),
      configurable: true,
      writable: true,
    });

    try {
      const found = document.querySelector("body");
      assert(found === document.body,
        "Proxied querySelector(body) should find body");
      assert(tracker.length >= 1,
        "Proxy handler should have tracked selector, got: " + tracker.length);
      assert(tracker[0] === "body",
        "Tracker should contain selector, got: " + tracker[0]);
    } finally {
      Object.defineProperty(Document.prototype, "querySelector", {
        value: origQS,
        configurable: true,
        writable: true,
      });
    }

    assert(typeof Proxy === "function", "Proxy constructor should be function");
    const proxiedFn = new Proxy(function() {}, {});
    assert(typeof proxiedFn === "function", "Proxy of function should be callable");
  `,
});
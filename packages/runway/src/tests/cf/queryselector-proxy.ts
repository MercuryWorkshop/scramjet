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
    const reg22 = [];
    reg22[0] = Document.prototype.querySelector;
    reg22[1] = Document.prototype.querySelectorAll;
    reg22[2] = Element.prototype.querySelector;
    reg22[3] = Element.prototype.querySelectorAll;

    for (let i = 0; i < reg22.length; i++) {
      assert(typeof reg22[i] === "function",
        "querySelector[" + i + "] should be function");
    }

    const prevBPOu4 = window.BPOu4;
    if (!Array.isArray(window.BPOu4)) window.BPOu4 = [];

    const handler = {
      apply(target, that, args) {
        if (args.length > 0) window.BPOu4.push(String(args[0]));
      },
    };

    const origDocQS = Document.prototype.querySelector;
    const origDocQSA = Document.prototype.querySelectorAll;
    const origElQS = Element.prototype.querySelector;
    const origElQSA = Element.prototype.querySelectorAll;

    Object.defineProperty(Document.prototype, "querySelector", {
      value: new Proxy(origDocQS, handler),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(Document.prototype, "querySelectorAll", {
      value: new Proxy(origDocQSA, handler),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(Element.prototype, "querySelector", {
      value: new Proxy(origElQS, handler),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(Element.prototype, "querySelectorAll", {
      value: new Proxy(origElQSA, handler),
      configurable: true,
      writable: true,
    });

    try {
      Document.prototype.querySelector.call(document, "body");
      Element.prototype.querySelector.call(document.body, "div");
      Document.prototype.querySelectorAll.call(document, "html");
      Element.prototype.querySelectorAll.call(document.body, "span");

      assert(window.BPOu4.length >= 4,
        "BPOu4 should collect selectors, got: " + window.BPOu4.length);
      assert(window.BPOu4[0] === "body",
        "BPOu4 should include first selector, got: " + window.BPOu4[0]);
    } finally {
      Object.defineProperty(Document.prototype, "querySelector", {
        value: origDocQS,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(Document.prototype, "querySelectorAll", {
        value: origDocQSA,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(Element.prototype, "querySelector", {
        value: origElQS,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(Element.prototype, "querySelectorAll", {
        value: origElQSA,
        configurable: true,
        writable: true,
      });
      if (prevBPOu4 === undefined) {
        delete window.BPOu4;
      } else {
        window.BPOu4 = prevBPOu4;
      }
    }

    assert(typeof Proxy === "function", "Proxy constructor should be function");
    const proxiedFn = new Proxy(function() {}, {});
    assert(typeof proxiedFn === "function", "Proxy of function should be callable");
  `,
});

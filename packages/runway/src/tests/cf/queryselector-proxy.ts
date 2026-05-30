import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_2210_8 / vm_func_3276_239:
// inner.vm_lifted.js:71-124,274-331
//   Turnstile collects Document/Element.prototype.querySelector/querySelectorAll
//   into window.yqJUn1, then wraps each with new Proxy(nativeFn, {apply: tracker}).
// vm_func_936_25, inner.vm_lifted.js:254-263:
//   The Proxy apply trap pushes String(args[0]) into window.BPOu4.
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
    const prevGGBX7 = window.GGBX7;
    const prevYqJUn1 = window.yqJUn1;
    window.BPOu4 = [];
    window.GGBX7 = "WdHvL7";
    window.yqJUn1 = reg22;

    const handler = {
      apply(target, that, args) {
        if (args.length > 0) window.BPOu4.push(String(args[0]));
        return Reflect.apply(target, that, args);
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

      const expectedSelectors = ["body", "div", "html", "span"];
      assert(JSON.stringify(window.BPOu4) === JSON.stringify(expectedSelectors),
        "BPOu4 should collect exact selector strings, got: " + JSON.stringify(window.BPOu4));
      assert(window.yqJUn1[0] === origDocQS && window.yqJUn1[1] === origDocQSA &&
        window.yqJUn1[2] === origElQS && window.yqJUn1[3] === origElQSA,
        "yqJUn1 should preserve the four original query selector functions");

      assertConsistent("queryselector-proxy-selectors", window.BPOu4.slice());
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
      if (prevGGBX7 === undefined) {
        delete window.GGBX7;
      } else {
        window.GGBX7 = prevGGBX7;
      }
      if (prevYqJUn1 === undefined) {
        delete window.yqJUn1;
      } else {
        window.yqJUn1 = prevYqJUn1;
      }
    }

    assert(typeof Proxy === "function", "Proxy constructor should be function");
    const proxiedFn = new Proxy(function() {}, {});
    assert(typeof proxiedFn === "function", "Proxy of function should be callable");
  `,
});

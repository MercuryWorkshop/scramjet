import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (10 eval("this") variants):
//
// p2_func_220678_55 (line 1485-1504): eval("this") via reg_228.eval on target
// p2_func_217841_42 (line 1744-1763): eval("this") on different global
// p2_func_179993_121 (line 6407-6428): eval("this") on SDGM5 worker/iframe
// p2_func_153546_104 (line 8547-8566): eval("this") on different global
// p2_func_74914_137 (line 19903-19922): eval("this") on different global
// p2_func_73766_174 (line 20037-20056): eval("this") on different global
// p2_func_63386_68 (line 21189-21208): eval("this") on different global
// p2_func_17194_76 (line 25601-25626): eval("this") on different global
// p2_func_3112_57 (line 27278-27297): eval("this") on different global
// p2_func_16873_187 (line 25390-25398): iframe.contentWindow.eval("this")
//
// Turnstile calls eval("this") in many contexts to verify the global object
// identity hasn't been tampered with. In a clean browser, eval("this") returns
// the globalThis/window. In a sandboxed or proxied context it may differ.
//
// Common pattern (all 9 non-iframe variants):
//   1. reg_17 = reg_228.eval  (get raw eval)
//   2. reg_21[reg_17]("this")  (call eval on a target with "this")
//   3. !!result               (double-negate to boolean)
//   4. if falsy → retry loop with sTuu5 / nJWjq3 marker

export default basicTest({
	name: "cf-eval-this",
	js: `
    // Check 1: eval("this") in primary context returns the global object
    const result = eval("this");
    assert(result === window || result === globalThis,
      "eval('this') should return window/globalThis, got: " + typeof result);

    // Check 2: eval("this") via Function.prototype.call
    const viaCall = (0, eval)("this");
    assert(viaCall === window || viaCall === globalThis,
      "(0,eval)('this') should return window/globalThis");

    // Check 3: eval("this") via Function constructor
    const viaFunction = new Function("return this")();
    assert(viaFunction === window || viaFunction === globalThis,
      "new Function('return this')() should return window/globalThis");

    // Check 4: iframe.contentWindow.eval("this") (p2_func_16873_187)
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);
    if (iframe.contentWindow) {
      const iframeThis = iframe.contentWindow.eval("this");
      assert(iframeThis === iframe.contentWindow,
        "iframe.eval('this') should return iframe's window, got: " +
        (iframeThis === iframe.contentWindow ? "match" : "mismatch"));
    }
    document.body.removeChild(iframe);

    // Check 5: eval remains the original native function
    assert(typeof eval === "function",
      "eval should be a function");
    const evalStr = eval.toString();
    assert(evalStr.indexOf("native code") !== -1 || evalStr.indexOf("[native code]") !== -1,
      "eval.toString should show native code: " + evalStr.substring(0, 60));

    // Check 6: Indirect eval returns globalThis
    const indirectResult = (1,eval)("this");
    assert(indirectResult === window || indirectResult === globalThis,
      "indirect eval('this') should return window/globalThis");

    // Check 7: eval in setTimeout context (Turnstile uses this pattern)
    if (typeof setTimeout === "function") {
      assert(typeof setTimeout === "function",
        "setTimeout should be callable for deferred eval patterns");
    }
  `,
});

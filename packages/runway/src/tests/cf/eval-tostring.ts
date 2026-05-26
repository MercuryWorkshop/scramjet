import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_472_142 (lines 435-448):
//   1. Date.now() → collect timestamp
//   2. eval.toString() → get eval's source
//   3. !evalStr → boolean negation (should be false for non-empty string)
//
// vm_func_137_252 (lines 341-363):
//   1. Create hidden iframe (width=0, height=0, position:absolute, sandbox)
//   2. contentWindow.eval.toString() → compare with main window
//
// Turnstile verifies eval.toString() is identical in both contexts.

export default basicTest({
  name: "cf-eval-tostring",
  js: `
    // vm_func_472_142: Date.now, eval.toString, boolean negations
    const reg19 = Date;
    const reg17 = reg19.now();
    const stack1 = (undefined + reg17);
    assert(typeof reg17 === "number", "Date.now should return number");
    assert(typeof stack1 === "number", "stack1 should be number");

    const reg22 = eval.toString();
    assert(typeof reg22 === "string", "eval.toString should return string");
    const reg19Neg = !reg19;
    assert(reg19Neg === false, "!Date should be false");
    const reg22Neg = !reg22;
    assert(reg22Neg === false, "!eval.toString() should be false");

    // vm_func_137_252: iframe contentWindow eval toString
    const iframe = document.createElement("iframe");
    iframe.width = 0;
    iframe.height = 0;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.sandbox = "allow-same-origin";
    document.body.appendChild(iframe);

    const cw = iframe.contentWindow;
    assert(typeof cw === "object", "iframe.contentWindow should exist");
    const cwEval = cw.eval;
    const cwEvalStr = cwEval.toString();
    assert(cwEvalStr === reg22,
      "contentWindow.eval.toString should match window.eval.toString");

    iframe.remove();
  `,
});

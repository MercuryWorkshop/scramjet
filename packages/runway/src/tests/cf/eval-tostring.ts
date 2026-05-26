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
    const t1 = Date.now();
    assert(typeof t1 === "number", "Date.now should return number");

    const evalStr = eval.toString();
    assert(typeof evalStr === "string", "eval.toString should return string");
    assert(evalStr.length > 0, "eval.toString should not be empty");
    assert(evalStr.indexOf("native code") !== -1 || evalStr.indexOf("[native code]") !== -1,
      "eval.toString should show native code: " + evalStr.substring(0, 60));

    const b1 = !evalStr;
    assert(b1 === false, "!evalStr should be false (non-empty string)");

    const iframe = document.createElement("iframe");
    iframe.width = 0;
    iframe.height = 0;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.sandbox = "allow-same-origin allow-scripts";
    document.body.appendChild(iframe);

    if (iframe.contentWindow) {
      const cwEval = iframe.contentWindow.eval;
      assert(typeof cwEval === "function", "contentWindow.eval should be function");
      const cwEvalStr = cwEval.toString();
      assert(cwEvalStr === evalStr, "iframe eval.toString should match main window");
      assert(cwEvalStr.indexOf("native code") !== -1, "iframe eval should show native code");
    }
    document.body.removeChild(iframe);

    const t2 = Date.now();
    assert(t2 >= t1, "Date.now should be monotonic");
  `,
});
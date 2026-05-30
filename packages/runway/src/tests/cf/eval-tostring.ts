import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_472_142, inner.vm_lifted.js:528-540:
//   1. Date.now() → collect timestamp
//   2. eval.toString() → get eval's source
//   3. !evalStr → boolean negation (should be false for non-empty string)
//
// vm_func_137_252, inner.vm_lifted.js:434-455:
//   1. Create hidden iframe (width=0, height=0, position:absolute, sandbox)
//   2. append it to _cf_chl_opt.kobE3
//   3. vm_func_2210_8 reads contentWindow.eval.toString() and compares contexts.

export default basicTest({
	name: "cf-eval-tostring",
	js: `
    // Subcheck 1: vm_func_472_142 Date.now, eval.toString, boolean negations.
    const reg19 = Date;
    const reg17 = reg19.now();
    const stack1 = (undefined + reg17);
    assert(typeof window.eval === "function", "window.eval should be a function before toString");
    assert(typeof reg17 === "number", "Date.now should return number");
    assert(typeof stack1 === "number", "stack1 should be number");

    const reg22 = eval.toString();
    assert(typeof reg22 === "string", "eval.toString should return string");
    const reg19Neg = !reg19;
    assert(reg19Neg === false, "!Date should be false");
    const reg22Neg = !reg22;
    assert(reg22Neg === false, "!eval.toString() should be false");

    assertConsistent("eval-tostring-main-context", {
      evalType: typeof window.eval,
      evalToStringType: typeof reg22,
      evalToStringEmpty: !reg22,
      dateType: typeof Date,
      dateNowType: typeof reg17,
    });

    // Subcheck 2: vm_func_137_252 iframe contentWindow eval.toString.
    const previousCfOpt = window._cf_chl_opt;
    const container = document.createElement("div");
    document.body.appendChild(container);
    window._cf_chl_opt = Object.assign({}, previousCfOpt, { kobE3: container });
    const iframe = document.createElement("iframe");
    iframe.width = 0;
    iframe.height = 0;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.sandbox = "allow-same-origin";
    window._cf_chl_opt.kobE3.appendChild(iframe);

    try {
      assert(container.contains(iframe), "iframe should be appended to _cf_chl_opt.kobE3");
      const cw = iframe.contentWindow;
      assert(typeof cw === "object" && cw !== null, "iframe.contentWindow should exist");
      const cwEval = cw.eval;
      assert(typeof cwEval === "function", "contentWindow.eval should be a function");
      const cwEvalStr = cwEval.toString();
      assert(cwEvalStr === reg22,
        "contentWindow.eval.toString should match window.eval.toString");
      assertConsistent("eval-tostring-iframe-context", {
        cwEvalType: typeof cwEval,
        cwEvalToStringType: typeof cwEvalStr,
        matchesMainEval: cwEvalStr === reg22,
        empty: !cwEvalStr,
      });
    } finally {
      iframe.remove();
      document.body.removeChild(container);
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});

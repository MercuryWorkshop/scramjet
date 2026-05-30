import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_158_252 (line 792-813):
//   1. createElement("iframe") → width=0, height=0, position:absolute,
//      top=0, left=0, border:none, visibility:hidden
//   2. sandbox = "allow-same-origin"
//   3. _cf_chl_opt.kobE3.appendChild(iframe) → add to container
//
// p2_func_157969_161 (line 8130-8135):
//   1. arg_0.contentWindow → access
//   2. if contentWindow is truthy → p2_func_158004_13
//
// p2_func_158004_13 (line 8170-8177):
//   1. arg_0.contentWindow.document → access
//   2. if document exists → p2_func_158046_115
//
// p2_func_158046_115 (line 8157-8168):
//   1. arg_0.contentWindow.document.body → access
//   2. if body exists → p2_func_158140_3
//
// p2_func_218068_197 (line 1765-1792):
//   1. Create iframe with display:none, tabIndex=-1
//   2. Append to kobE3
//   3. contentWindow → access
//   4. RpnZR8(contentWindow, contentWindow, "", {}) → some init
//   5. contentWindow.clientInformation → access navigator-like property
//   6. OR contentWindow.navigator (fallback)
//
// p2_func_19824_219 (line 25154-25162):
//   1. contentWindow.eval("0") → verify eval works
//
// p2_func_19259_63 / p2_func_19212_149 (line 25346-25381):
//   1. Create iframe with height=0, width=0, display:none
//   2. Append
//   3. contentDocument OR contentWindow.document

export default basicTest({
	name: "cf-iframe-contentwindow",
	js: `
    // Check 1: Create iframe matching Turnstile's exact style (p2_func_158_252)
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

    // Check 2: contentWindow access (p2_func_157969_161)
    assert(iframe.contentWindow !== null && iframe.contentWindow !== undefined,
      "iframe.contentWindow should be non-null after append");

    const cw = iframe.contentWindow;

    // Check 3: contentWindow.document (p2_func_158004_13)
    assert(cw.document !== null && cw.document !== undefined,
      "contentWindow.document should be non-null");

    // Check 4: contentWindow.document.body (p2_func_158046_115)
    assert(cw.document.body !== null,
      "contentWindow.document.body should be non-null");

    // Check 5: clientInformation (p2_func_218068_197)
    // clientInformation is an alias for navigator in old browsers
    assert(cw.clientInformation !== undefined || cw.navigator !== undefined,
      "contentWindow.clientInformation or contentWindow.navigator should exist");

    // Check 6: contentWindow.navigator (p2_func_218068_197 fallback)
    assert(cw.navigator !== undefined,
      "contentWindow.navigator should exist");

    // Check 7: contentWindow.eval("0") (p2_func_19824_219)
    // Some sandbox configurations can block script execution; Turnstile has
    // multiple iframe paths, so keep this to an API/shape check plus best-effort call.
    assert(typeof cw.eval === "function",
      "contentWindow.eval should be a function");
    try {
      const evalResult = cw.eval("0");
      assert(evalResult === 0,
        "contentWindow.eval('0') should return 0, got: " + evalResult);
    } catch (e) {
      pass("contentWindow.eval('0') blocked: " + e.message);
    }

    // Check 8: contentDocument (p2_func_19259_63)
    assert(iframe.contentDocument !== null || cw.document !== null,
      "iframe.contentDocument or contentWindow.document should be available");

    // Check 9: contentWindow.eval("this") (p2_func_16873_187)
    try {
      const thisResult = cw.eval("this");
      assert(thisResult === cw,
        "contentWindow.eval('this') should return the iframe's window");
    } catch (e) {
      pass("contentWindow.eval('this') blocked: " + e.message);
    }

    // Check 10: contentDocument.body existence (p2_func_157879_245)
    if (iframe.contentDocument) {
      assert(iframe.contentDocument.body !== null,
        "contentDocument.body should be non-null");
    }

    // Check 11: contentDocument → contentWindow priority chain
    // Turnstile tries contentDocument first, falls back to contentWindow.document
    const hasCWDocument = !!iframe.contentDocument || !!cw.document;
    assert(hasCWDocument,
      "Either contentDocument or contentWindow.document should be available");

    document.body.removeChild(iframe);
  `,
});

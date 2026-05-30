import { basicTest } from "../../testcommon.ts";

// Exact inner VM sequence from inner.vm_lifted.js:28-36 and iframe creator
// vm_func_137_252 at inner.vm_lifted.js:434-455:
//
//   1. window.eval.toString()
//   2. document.createElement("iframe")
//   3. iframe.width = 0; iframe.height = 0
//   4. iframe.style.position = "absolute"
//      iframe.style.top = 0; iframe.style.left = 0
//      iframe.style.border = "none"; iframe.style.visibility = "hidden"
//   5. iframe.sandbox = "allow-same-origin"
//   6. append to window._cf_chl_opt.kobE3
//   7. iframe.contentWindow.eval.toString()
//   8. iframe.remove()

export default basicTest({
	name: "cf-iframe-eval-tostring-realm",
	js: `
    const mainEvalToString = window.eval.toString();
    const iframe = document.createElement("iframe");
    const container = window._cf_chl_opt && window._cf_chl_opt.kobE3
      ? window._cf_chl_opt.kobE3
      : document.body;

    let iframeEvalToString = null;
    try {
      iframe.width = 0;
      iframe.height = 0;
      iframe.style.position = "absolute";
      iframe.style.top = 0;
      iframe.style.left = 0;
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      iframe.sandbox = "allow-same-origin";
      container.appendChild(iframe);

      assert(iframe.contentWindow !== null,
        "iframe.contentWindow should exist after append");
      iframeEvalToString = iframe.contentWindow.eval.toString();

      assert(typeof mainEvalToString === "string",
        "window.eval.toString() should return string");
      assert(typeof iframeEvalToString === "string",
        "iframe.contentWindow.eval.toString() should return string");

      assertConsistent("iframe-eval-tostring-realm", {
        appendTargetWasKobE3: !!(window._cf_chl_opt && window._cf_chl_opt.kobE3),
        mainEvalToString,
        iframeEvalToString,
        same: mainEvalToString === iframeEvalToString,
      });
    } finally {
      iframe.remove();
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_101127_201 (line 16448): window.eval → check existence
// p2_func_118019_250 (line 13842): XMLHttpRequest.prototype.send → check existence
// p2_func_108643_47 (line 15874): NavigatorUAData.prototype.getHighEntropyValues
// p2_func_104872_215 (line 16141): HTMLCanvasElement.prototype.toDataURL
// p2_func_91377_161 (line 17781): CanvasRenderingContext2D.prototype.getImageData
// p2_func_90571_81 (line 18360): CanvasRenderingContext2D.prototype.fillText
//
// Each check does: access prototype → access property → verify it exists
// If any property is missing/falsy, Turnstile flags the environment.
// Scramjet may modify: eval, XMLHttpRequest, sendBeacon

export default basicTest({
  name: "cf-api-integrity",
  js: `
    // Check 1: window.eval must be a function (p2_func_101127_201)
    assert(typeof eval === "function",
      "window.eval should be a function");
    const evalStr = eval.toString();
    assert(evalStr.indexOf("native code") !== -1 || evalStr.indexOf("[native code]") !== -1,
      "eval.toString should show native code: " + evalStr.substring(0, 60));

    // Check 2: XMLHttpRequest.prototype.send (p2_func_118019_250)
    assert(typeof XMLHttpRequest.prototype.send === "function",
      "XMLHttpRequest.prototype.send should be a function");
    const xhrStr = XMLHttpRequest.prototype.send.toString();
    assert(xhrStr.indexOf("native code") !== -1 || xhrStr.indexOf("[native code]") !== -1,
      "XHR.send.toString should show native code");

    // Check 3: Navigator.prototype.sendBeacon (line 15868)
    assert(typeof Navigator.prototype.sendBeacon === "function",
      "Navigator.prototype.sendBeacon should be a function");

    // Check 4-6: Canvas-related prototype methods
    assert(typeof HTMLCanvasElement.prototype.toDataURL === "function",
      "HTMLCanvasElement.prototype.toDataURL should be a function");
    assert(typeof CanvasRenderingContext2D.prototype.getImageData === "function",
      "CanvasRenderingContext2D.getImageData should be a function");
    assert(typeof CanvasRenderingContext2D.prototype.fillText === "function",
      "CanvasRenderingContext2D.fillText should be a function");
  `,
});
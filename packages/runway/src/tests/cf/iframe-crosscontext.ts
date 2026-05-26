import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_218068_197 (line 1765-1792):
//   1. nJWjq3(handler) → register handler
//   2. qZqeT2 = 0; dnsDH6 = ""
//   3. sTuu5(result) → signal completed step
//   4. createElement("iframe") → style.display = "none", tabIndex = "-1"
//   5. appendChild to kobE3
//   6. contentWindow → RpnZR8(contentWindow, contentWindow, "", {}) → init context
//   7. contentWindow.clientInformation → if absent, fall back to contentWindow.navigator
//
// p2_func_218520_111 (line 1794-1813):
//   1. contentWindow.screen → access screen object
//   2. contentWindow.screen.orientation → access orientation
//   3. window.RpnZR8 → some init function
//   4. window.LMOV1 → provides language
//   5. contentWindow.performance.getEntriesByType("navigation")
//   6. Navigation entry: decodedBodySize, encodedBodySize, serverTiming
//
// p2_func_218517_45 (line ~1780):
//   Follows contentWindow.clientInformation path
//
// p2_func_236024_95 (line 1316-1334):
//   Timing delta calculation: Data.now() reading

export default basicTest({
  name: "cf-iframe-crosscontext",
  js: `
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.tabIndex = -1;
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);

    const cw = iframe.contentWindow;
    assert(cw !== null, "iframe.contentWindow should be non-null");

    // Check 1: clientInformation vs navigator (p2_func_218068_197)
    assert(cw.clientInformation !== undefined || cw.navigator !== undefined,
      "contentWindow should have clientInformation or navigator");
    // clientInformation is the same as navigator in modern browsers
    assert(cw.clientInformation === cw.navigator || cw.clientInformation === undefined,
      "contentWindow.clientInformation should be navigator or undefined");

    // Check 2: contentWindow.screen (p2_func_218520_111)
    assert(cw.screen !== null && cw.screen !== undefined,
      "contentWindow.screen should exist");
    assert(typeof cw.screen.width === "number",
      "contentWindow.screen.width should be a number");
    assert(typeof cw.screen.height === "number",
      "contentWindow.screen.height should be a number");
    assert(typeof cw.screen.colorDepth === "number",
      "contentWindow.screen.colorDepth should be a number");

    // Check 3: contentWindow.screen.orientation (p2_func_218520_111)
    if (cw.screen.orientation) {
      assert(typeof cw.screen.orientation.type === "string",
        "screen.orientation.type should be a string, got: " + cw.screen.orientation.type);
      assert(typeof cw.screen.orientation.angle === "number",
        "screen.orientation.angle should be a number");
    }

    // Check 4: performance.getEntriesByType("navigation") (p2_func_218520_111)
    if (cw.performance && cw.performance.getEntriesByType) {
      const navEntries = cw.performance.getEntriesByType("navigation");
      assert(Array.isArray(navEntries),
        "contentWindow getEntriesByType('navigation') should return array");
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        assert(typeof nav.decodedBodySize === "number" || nav.decodedBodySize === undefined,
          "navigation entry should have decodedBodySize");
        assert(typeof nav.encodedBodySize === "number" || nav.encodedBodySize === undefined,
          "navigation entry should have encodedBodySize");
        assert(typeof nav.serverTiming === "object" || nav.serverTiming === undefined,
          "navigation entry should have serverTiming");
        assert(typeof nav.type === "string",
          "navigation entry.type should be a string");
        assert(typeof nav.domComplete === "number",
          "navigation entry.domComplete should be a number");
      }
    }

    document.body.removeChild(iframe);
  `,
});
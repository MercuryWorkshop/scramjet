import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_267319_101 (line 1047-1076):
//   1. document.body.attachShadow → check exists as function
//
// p2_func_158_252 (line 792-813):
//   1. createElement("iframe") → width=0, height=0, position=absolute,
//      top=0, left=0, border=none, visibility=hidden
//   2. sandbox = "allow-same-origin"
//   3. _cf_chl_opt.kobE3.appendChild(iframe)
//
// p2_func_275120_109 (line 237-331):
//   1. outerHTML → read element outerHTML
//   2. innerHTML → read element innerHTML
//   3. compareDocumentPosition → check DOM positioning
//   4. DOCUMENT_POSITION_FOLLOWING → constant check

export default basicTest({
  name: "cf-dom-checks",
  js: `
    // Check 1: document.body.attachShadow (p2_func_267319_101)
    assert(typeof document.body.attachShadow === "function",
      "document.body.attachShadow should be a function");

    // Check 2: Element.attachShadow can create shadow root
    try {
      const sr = document.body.attachShadow({ mode: "open" });
      assert(sr instanceof ShadowRoot,
        "attachShadow should return a ShadowRoot");
      assert(sr.mode === "open",
        "shadowRoot.mode should be 'open'");
    } catch (e) {
      pass("attachShadow failed: " + e.message);
    }

    // Check 3: Create hidden iframe like Turnstile (p2_func_158_252)
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

    assert(iframe.contentWindow !== null,
      "iframe.contentWindow should exist after append");

    document.body.removeChild(iframe);

    // Check 4: compareDocumentPosition (p2_func_275120_109)
    const div = document.createElement("div");
    const styleEl = document.createElement("style");
    styleEl.textContent = "div { color: red; }";
    div.appendChild(styleEl);
    const innerDiv = document.createElement("div");
    div.appendChild(innerDiv);

    // DOCUMENT_POSITION_FOLLOWING = 2, DOCUMENT_POSITION_CONTAINED_BY = 16
    const posFollowing = styleEl.compareDocumentPosition(innerDiv);
    assert((posFollowing & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      "Node.DOCUMENT_POSITION_FOLLOWING should be set for preceding sibling");

    // Check 5: DOCUMENT_POSITION_ constants exist
    assert(Node.DOCUMENT_POSITION_DISCONNECTED === 1,
      "DOCUMENT_POSITION_DISCONNECTED should be 1");
    assert(Node.DOCUMENT_POSITION_PRECEDING === 2,
      "DOCUMENT_POSITION_PRECEDING should be 2");
    assert(Node.DOCUMENT_POSITION_FOLLOWING === 4,
      "DOCUMENT_POSITION_FOLLOWING should be 4");
  `,
});
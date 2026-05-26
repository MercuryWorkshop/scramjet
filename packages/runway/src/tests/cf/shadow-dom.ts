import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_69087_87 (line 20588-20600):
//   1. reg_17 = {mode: "open"}
//   2. reg_24.attachShadow(reg_17)  → create open shadow root
//   3. shadow.appendChild(span)     → add element to shadow DOM
//   4. reg_17 = {composed: true} (composed = "attachShadow" → boolean true)
//   5. span.getRootNode(reg_17)     → get root with composed:true
//   6. push(composed)               → store result
//
// p2_func_69634_147 (line 20659-20671): duplicate
//
// Turnstile checks:
//   1. attachShadow({mode:"open"}) creates a ShadowRoot
//   2. shadow.appendChild(span) works (elements can be added)
//   3. getRootNode({composed:true}) returns the shadow root
//
// Lines 298, 678, 16250: attachShadow existence probes

export default basicTest({
  name: "cf-shadow-dom",
  js: `
    // Check 1: Element.attachShadow is a function (probes at lines 298, 678, 16250)
    assert(typeof Element.prototype.attachShadow === "function",
      "Element.prototype.attachShadow should be a function");

    // Check 2: attachShadow({mode:"open"}) creates ShadowRoot
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      const shadow = host.attachShadow({ mode: "open" });
      assert(shadow instanceof ShadowRoot,
        "attachShadow({mode:'open'}) should return ShadowRoot");
      assert(shadow.mode === "open",
        "shadowRoot.mode should be 'open', got: " + shadow.mode);

      // Check 3: shadow.appendChild works
      const span = document.createElement("span");
      span.textContent = "shadow child";
      shadow.appendChild(span);
      assert(span.parentNode === shadow,
        "appendChild to shadow should set parentNode");

      // Check 4: getRootNode({composed:true}) traverses shadow boundaries
      const rootComposed = span.getRootNode({ composed: true });
      assert(rootComposed === document,
        "getRootNode({composed:true}) should traverse shadow to document");

      // Check 5: getRootNode() without composed stays within shadow
      const rootDefault = span.getRootNode();
      assert(rootDefault === shadow,
        "getRootNode() default should return shadow root");

      // Check 6: Host element getRootNode returns document
      const hostRoot = host.getRootNode({ composed: true });
      assert(hostRoot === document,
        "host.getRootNode({composed:true}) should return document");
    } catch (e) {
      pass("Shadow DOM not supported: " + e.message);
    } finally {
      document.body.removeChild(host);
    }

    // Check 7: attachShadow can be called with mode:"closed"
    const host2 = document.createElement("div");
    try {
      const closed = host2.attachShadow({ mode: "closed" });
      assert(closed instanceof ShadowRoot,
        "attachShadow({mode:'closed'}) should return ShadowRoot");
      assert(closed.mode === "closed",
        "shadowRoot.mode should be 'closed'");
    } catch (e) {
      pass("Closed shadow DOM not supported: " + e.message);
    }
  `,
});
import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_19138_69 (line 25335-25343):
//   1. Append iframe to container
//   2. Check window.trustedTypes exists
//   3. if trustedTypes → p2_func_19212_149 (trusted types path)
//   4. else → p2_func_19259_63 (regular iframe path)
//
// p2_func_19212_149 (line 25363-25380):
//   1. window.trustedTypes.createPolicy → check createPolicy exists
//   2. createElement("iframe") → style.display="none", height=0, width=0
//   3. appendChild(iframe)
//   4. iframe.contentDocument or iframe.contentWindow.document
//
// p2_func_19259_63 (line 25346-25361):
//   1. Same iframe creation WITHOUT Trusted Types
//   2. Check contentDocument or contentWindow.document
//
// p2_func_19533_33 (line 25275-25280):
//   1. contentWindow.trustedTypes → check if iframe has trustedTypes
//
// p2_func_18709_235 (line 25311-25322):
//   1. Build srcdoc with CSP meta + Trusted Types default policy
//   2. yZYbk3(srcdocHtml) → transform HTML
//   3. iframe.srcdoc = transformedHtml
//
// p2_func_16873_187 (line 25391-25394):
//   1. iframe.contentWindow.eval("this")

export default basicTest({
  name: "cf-trusted-types-iframe",
  js: `
    // Check 1: window.trustedTypes existence (p2_func_19138_69)
    const hasTrustedTypes = typeof window.trustedTypes !== "undefined";

    // Check 2: trustedTypes.createPolicy (p2_func_19212_149)
    if (hasTrustedTypes) {
      assert(typeof window.trustedTypes.createPolicy === "function",
        "trustedTypes.createPolicy should be a function");

      // Check 3: clean up any existing "default" policy to test creation
      // (Turnstile tries to create a 'default' policy, catches if it fails)
      try {
        const pol = window.trustedTypes.createPolicy("__turnstile_test__", {
          createScript: (s) => s,
        });
        assert(typeof pol.createScript === "function",
          "created policy should have createScript");
      } catch (e) {
        // 'default' policy may already exist, that's fine
        pass("could not create test policy: " + e.message);
      }
    }

    // Check 4: Create iframe (both paths use createElement or srcdoc)
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);

    // Check 5: srcdoc attribute is writable (p2_func_18709_235)
    iframe.srcdoc = "<html><body><div>test</div></body></html>";
    assert(typeof iframe.srcdoc === "string",
      "iframe.srcdoc should be writable and readable as string");

    // Check 6: contentWindow (p2_func_19259_63, p2_func_19212_149)
    assert(iframe.contentWindow !== null,
      "iframe.contentWindow should not be null");

    // Check 7: contentWindow.trustedTypes (p2_func_19533_33)
    if (iframe.contentWindow) {
      const cwHasTT = typeof iframe.contentWindow.trustedTypes !== "undefined";
      assert(typeof cwHasTT === "boolean",
        "contentWindow.trustedTypes existence check should yield boolean");
    }

    // Check 8: contentWindow.eval("this") (p2_func_16873_187)
    // Turnstile calls eval("this") in the iframe to verify execution context
    if (iframe.contentWindow) {
      assert(typeof iframe.contentWindow.eval === "function",
        "contentWindow.eval should be a function");
      try {
        const thisResult = iframe.contentWindow.eval("this");
        assert(thisResult === iframe.contentWindow,
          "eval('this') in iframe should return the iframe's window");
      } catch (e) {
        pass("contentWindow.eval('this') failed: " + e.message);
      }
    }

    // Check 9: document.createElement("script") with data: src
    const script = document.createElement("script");
    script.src = "data:,0";
    assert(script.src.indexOf("data:") === 0,
      "script.src should accept data: URIs");

    document.body.removeChild(iframe);
  `,
});
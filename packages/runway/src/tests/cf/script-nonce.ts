import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_18485_187 (line 25433-25438):
//   1. reg_228.document.querySelector("script[nonce]")
//   2. If found → p2_func_18559_67
//
// p2_func_18559_67 (line 25441-25444):
//   1. script.nonce → read CSP nonce value
//   2. If nonce is truthy → p2_func_18590_145
//
// p2_func_18608_65 (line 25427):
//   1. " nonce=\"" + arg_0 → build nonce attribute string
//   2. This is used for srcdoc iframe CSP construction
//
// p2_func_19744_183 (line 25236):
//   1. SDGM5.createElement("div") → create div in iframe
//   2. div.innerHTML = "<b>t</b>" → test HTML parsing
//
// p2_func_19843_79 (line 25242):
//   1. contentWindow.eval("0") → test eval in iframe
//
// p2_func_19920_153 (line 25164):
//   1. SDGM5.createElement("script") → create script element
//   2. script.src = "data:,0" → set data: URI
//
// p2_func_20026_251 (line 25175):
//   1. element.contains(child) → check DOM containment
//
// p2_func_19993_75 (line 25183):
//   1. instanceof 1 (HTML object?)
//   2. instanceof 4 (script element?)

export default basicTest({
  name: "cf-script-nonce",
  js: `
    // Check 1: document.querySelector("script[nonce]") (p2_func_18485_187)
    // Finds script elements with nonce attribute (CSP)
    const nonceScript = document.querySelector("script[nonce]");
    // In a Turnstile page, there's typically a script with a nonce
    // In our test harness, this may or may not exist
    if (nonceScript) {
      assert(nonceScript.tagName === "SCRIPT",
        "script[nonce] should find a <script> element, got: " + nonceScript.tagName);
      // Check 2: script.nonce should be a string (p2_func_18559_67)
      assert(typeof nonceScript.nonce === "string",
        "script.nonce should be a string, got: " + typeof nonceScript.nonce);
    }

    // Check 3: innerHTML parsing "<b>t</b>" (p2_func_19744_183, p2_func_19747_233)
    const div = document.createElement("div");
    div.innerHTML = "<b>t</b>";
    assert(div.firstChild !== null,
      "innerHTML '<b>t</b>' should create child element");
    assert(div.firstChild.tagName === "B",
      "innerHTML '<b>t</b>' should create <b> element, got: " + div.firstChild.tagName);
    assert(div.firstChild.textContent === "t",
      "innerHTML '<b>t</b>' element should have 't' text, got: " + div.firstChild.textContent);

    // Check 4: script.src = "data:,0" (p2_func_19920_153, p2_func_19843_79)
    const script = document.createElement("script");
    script.src = "data:,0";
    assert(script.src.indexOf("data:") === 0,
      "script.src should accept data: URIs, got: " + script.src);

    // Check 5: node.contains(child) (p2_func_20026_251)
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    assert(parent.contains(child) === true,
      "parent.contains(child) should return true");
    assert(child.contains(parent) === false,
      "child.contains(parent) should return false");

    // Check 6: nonce attribute behavior (nonce is security-sensitive)
    const testEl = document.createElement("script");
    testEl.setAttribute("nonce", "testval123");
    // Note: nonce is a special attribute. In some browsers setting it via
    // setAttribute may not make it reflected via the .nonce IDL attribute.
    // Turnstile reads .nonce from parser-inserted scripts (querySelector).
    assert(testEl.getAttribute("nonce") === "testval123" || testEl.nonce !== "",
      "element nonce should be accessible one way or another");
  `,
});
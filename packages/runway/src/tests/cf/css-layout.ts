import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_19930 (line 19930-19959) — CSS transform fingerprinting:
//   1. Create container div: position:fixed, 800x900, visibility:hidden
//   2. Generate complex HTML with CSS transforms (skew, scale, matrix, perspective)
//   3. yZYbk3(html) → transform HTML (scramjet CSS rewriter)
//   4. innerHTML = transformed → insert styled nodes
//   5. appendChild(container) → add to DOM
//   6. Array of 10 element IDs, each checked:
//      - getBoundingClientRect() → position/size
//      - getComputedStyle() → transform, border, font values
//   7. Results compared for parity check between canvases/contexts
//
// The getComputedStyle check validates CSS transform rendering at the
// engine level. Different browsers/versions produce slightly different
// computed values, hence Turnstile uses this for fingerprinting.

export default basicTest({
	name: "cf-css-layout",
	js: `
    // Check 1: Container with CSS as Turnstile creates (p2_func_19930)
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:0;top:0;width:800px;height:900px;visibility:hidden;overflow:hidden";
    document.body.appendChild(container);

    // Check 2: Element with CSS transforms (matching Turnstile's test elements)
    const el = document.createElement("div");
    el.textContent = "CSS test";
    el.style.cssText = "border:2px solid purple;font-size:30px;transform:skewY(23.1753218deg);position:absolute;top:100px;left:50px";
    container.appendChild(el);

    // Check 3: getBoundingClientRect (used by Turnstile to measure position)
    const rect = el.getBoundingClientRect();
    assert(typeof rect.top === "number",
      "getBoundingClientRect.top should be a number");
    assert(typeof rect.left === "number",
      "getBoundingClientRect.left should be a number");
    assert(typeof rect.width === "number",
      "getBoundingClientRect.width should be a number");
    assert(typeof rect.height === "number",
      "getBoundingClientRect.height should be a number");
    assert(rect.width > 0,
      "getBoundingClientRect.width should be > 0, got: " + rect.width);
    assert(rect.height > 0,
      "getBoundingClientRect.height should be > 0, got: " + rect.height);

    // Check 4: Element measurements (offset, client, scroll)
    assert(typeof el.offsetWidth === "number",
      "offsetWidth should be a number");
    assert(typeof el.offsetHeight === "number",
      "offsetHeight should be a number");
    assert(typeof el.clientWidth === "number",
      "clientWidth should be a number");
    assert(typeof el.clientHeight === "number",
      "clientHeight should be a number");

    // Check 5: getComputedStyle (Turnstile's main CSS integrity check)
    const cs = getComputedStyle(el);
    assert(typeof cs === "object",
      "getComputedStyle should return an object");
    assert(typeof cs.getPropertyValue === "function",
      "CSSStyleDeclaration.getPropertyValue should be a function");
    assert(typeof cs.item === "function",
      "CSSStyleDeclaration.item should be a function");

    // Check 6: CSS transform property is readable
    const transformVal = cs.getPropertyValue("transform");
    assert(typeof transformVal === "string",
      "getComputedStyle transform should be a string");

    // Check 7: CSS border and font values
    assert(typeof cs.borderTopWidth === "string",
      "getComputedStyle borderTopWidth should be a string");
    assert(typeof cs.fontSize === "string",
      "getComputedStyle fontSize should be a string");

    document.body.removeChild(container);
  `,
});

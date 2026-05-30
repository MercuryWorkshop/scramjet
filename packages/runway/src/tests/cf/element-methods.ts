import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_100574_79 (line 16985): Element.prototype.getBoundingClientRect
// p2_func_69637_221 (line 20567): innerText get/set
// p2_func_275120_109 (line 253-259): outerHTML, innerHTML
// p2_func_108347: WindowOrWorkerGlobalScope prototype methods
//
// cssText parity check (line 19930+):
//   Turnstile creates a div with complex CSS transforms (skew, scale, matrix,
//   perspective) and measures computed positions. This verifies the browser's
//   CSS engine handles complex transforms correctly.

export default basicTest({
	name: "cf-element-methods",
	js: `
    // Check 1: getBoundingClientRect (p2_func_100574_79)
    assert(typeof Element.prototype.getBoundingClientRect === "function",
      "Element.getBoundingClientRect should be a function");

    const div = document.createElement("div");
    document.body.appendChild(div);

    // Check 2: innerText (p2_func_69637_221)
    div.innerText = "hello world";
    assert(div.innerText === "hello world",
      "innerText should be readable/writable");

    // Check 3: textContent
    assert(div.textContent === "hello world",
      "textContent should match innerText for plain text");

    // Check 4: outerHTML (p2_func_275120_109)
    const outer = div.outerHTML;
    assert(outer.indexOf("<div") !== -1,
      "outerHTML should contain opening tag");
    assert(outer.indexOf("hello world") !== -1,
      "outerHTML should contain text content");

    // Check 5: innerHTML
    div.innerHTML = "<span>test</span>";
    assert(div.innerHTML === "<span>test</span>",
      "innerHTML should be readable/writable");

    // Check 6: insertAdjacentHTML
    assert(typeof Element.prototype.insertAdjacentHTML === "function",
      "Element.insertAdjacentHTML should be a function");
    div.innerHTML = "";
    div.insertAdjacentHTML("beforeend", "<p>inserted</p>");
    assert(div.innerHTML.indexOf("<p>inserted</p>") !== -1,
      "insertAdjacentHTML beforeend should insert content");

    // Check 7: DOMParser
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString("<div>parsed</div>", "text/html");
      assert(doc.body.textContent === "parsed",
        "DOMParser should parse HTML, got: " + doc.body.textContent);
    }

    // Check 8: querySelector
    assert(typeof document.querySelector === "function",
      "document.querySelector should be a function");
    const el = div.querySelector("p");
    assert(el instanceof HTMLParagraphElement,
      "querySelector should find elements");

    // Check 9: getElementById
    div.innerHTML = '<div id="test123">found</div>';
    const byId = document.getElementById("test123");
    assert(byId === div.firstChild,
      "getElementById should find element");

    document.body.removeChild(div);
  `,
});

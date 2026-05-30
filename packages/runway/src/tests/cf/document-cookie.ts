import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_206429_27 (line 3186-3197) + p2_func_206511_229 (line 3258-3289):
//   1. document.forms.length → push to results array
//   2. document.cookie → access cookie string
//   3. if cookie.length > 0 → push length to results
//   4. Store cookie results in noJS8
//
// Event handler checks (p2_func_206546_175 / p2_func_206511_229):
//   5. document.onchange → push to event handlers array
//   6. document.onclick → push
//   7. document.onmouseover → push
//   8. document.onmouseout → push
//   9. document.onkeydown → push
//   10. document.onload → push
//   11. Store handlers in AQlGu6
//
//   12. document.title → read (further in the chain)

export default basicTest({
	name: "cf-document-cookie",
	js: `
    // Check 1: document.cookie is a string (p2_func_206429_27)
    assert(typeof document.cookie === "string",
      "document.cookie should be a string");

    // Check 2: document.cookie.length is a number (p2_func_206511_229)
    const cookieLen = document.cookie.length;
    assert(typeof cookieLen === "number",
      "document.cookie.length should be a number");

    // Check 3: document.forms exists with length (p2_func_206429_27)
    assert(document.forms !== undefined,
      "document.forms should exist");
    assert(typeof document.forms.length === "number",
      "document.forms.length should be a number");

    // Check 4: document event handler properties exist (p2_func_206511_229)
    // Turnstile tests: onchange, onclick, onmouseover, onmouseout,
    // onkeydown, onload
    const handlerProps = [
      "onchange",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onkeydown",
      "onload",
    ];
    for (const prop of handlerProps) {
      assert(prop in document,
        "document." + prop + " should exist");
      // Turnstile pushes the value (which may be null) to results array
      // This verifies the property is accessible
      const val = document[prop];
      assert(val === null || typeof val === "function",
        "document." + prop + " should be null or a function, got: " + typeof val);
    }

    // Check 5: document.title is a string
    assert(typeof document.title === "string",
      "document.title should be a string");
  `,
});

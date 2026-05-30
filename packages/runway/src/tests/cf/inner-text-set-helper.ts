import { basicTest } from "../../testcommon.ts";

// Ports A() text helper from data4/inner.js_translated.js:7214-7216.

export default basicTest({
	name: "cf-inner-text-set-helper",
	js: `
    const node = document.createElement("span");
    function s(key, map) { return (map || { turnstile_success: "Success!" })[key] || ""; }
    function L(q, W) { q.innerHTML = W; }
    function A(q, W, T) { L(q, s(W, T)); }
    A(node, "turnstile_success");
    const observed = { html: node.innerHTML, text: node.textContent };
    assert(observed.text === "Success!", "A should set translated text through L");
    assertConsistent("inner-text-set-helper", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Checkbox DOM skeleton from inner.js_translated.js:4741-4764:
// creates a flex alert container `.cb-c`, label `.cb-lb`, checkbox input,
// icon span `.cb-i`, text span `.cb-lb-t`, appends it to d4(), and returns the
// checkbox input.

export default basicTest({
	name: "cf-inner-checkbox-dom-skeleton",
	js: `
    const root = document.createElement("div");
    document.body.appendChild(root);

    try {
      function s(key) { return key === "checkbox_label" ? "Verify you are human" : key; }
      function L(node, text) { node.textContent = text; }
      function d4() { return root; }

      const E = s("checkbox_label");
      const dy = document.createElement("div");
      dy.height = "10 em";
      dy.style.display = "flex";
      dy.className = "cb-c";
      dy.setAttribute("role", "alert");
      const label = document.createElement("label");
      label.className = "cb-lb";
      const input = document.createElement("input");
      input.type = "checkbox";
      label.appendChild(input);
      const icon = document.createElement("span");
      icon.className = "cb-i";
      label.appendChild(icon);
      const text = document.createElement("span");
      L(text, E);
      text.className = "cb-lb-t";
      label.appendChild(text);
      dy.appendChild(label);
      const N = d4();
      if (N) N.appendChild(dy);

      const observed = {
        containerClass: dy.className,
        containerDisplay: dy.style.display,
        role: dy.getAttribute("role"),
        labelClass: label.className,
        inputType: input.type,
        iconClass: icon.className,
        textClass: text.className,
        textContent: text.textContent,
        rootChildCount: root.children.length,
        returnedIsInput: input instanceof HTMLInputElement,
      };

      assert(observed.containerClass === "cb-c" && observed.containerDisplay === "flex", "checkbox container shape mismatch");
      assert(observed.role === "alert", "checkbox container role mismatch");
      assert(observed.labelClass === "cb-lb", "checkbox label class mismatch");
      assert(observed.inputType === "checkbox", "checkbox input type mismatch");
      assert(observed.iconClass === "cb-i" && observed.textClass === "cb-lb-t", "checkbox child classes mismatch");
      assert(observed.textContent === "Verify you are human", "checkbox label text mismatch");
      assert(observed.rootChildCount === 1 && observed.returnedIsInput, "checkbox skeleton append/return mismatch");
      assertConsistent("inner-checkbox-dom-skeleton", observed);
    } finally {
      root.remove();
    }
  `,
});

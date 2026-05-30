import { basicTest } from "../../testcommon.ts";

// Ports the not-embedded alert renderer du() from data4/inner.js_translated.js:6955-6997.

export default basicTest({
	name: "cf-inner-not-embedded-alert-dom",
	js: `
    const root = document.createElement("div");
    root.id = "sYLb1";
    document.body.appendChild(root);

    try {
      function s(key) {
        return key === "not_embedded" ? "This challenge must be embedded into a parent page." : key;
      }
      function dh(id) { return document.getElementById(id); }
      function L(node, html) { node.innerHTML = html; }
      function du(q) {
        const T = document.createElement("div");
        const f = document.createElement("p");
        f.style.backgroundColor = "#de5052";
        f.style.borderColor = "#521010";
        f.style.color = "#fff";
        L(f, s(q));
        T.appendChild(f);
        dh("sYLb1").appendChild(T);
      }

      du("not_embedded");
      const p = root.querySelector("p");
      const observed = {
        children: root.children.length,
        text: p?.textContent,
        background: p?.style.backgroundColor,
        border: p?.style.borderColor,
        color: p?.style.color,
      };

      assert(observed.children === 1, "du should append one alert wrapper");
      assert(observed.text?.includes("embedded"), "du should render translated not_embedded text");
      assertConsistent("inner-not-embedded-alert-dom", observed);
    } finally {
      root.remove();
    }
  `,
});

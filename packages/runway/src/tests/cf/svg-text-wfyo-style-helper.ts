import { basicTest } from "../../testcommon.ts";

// Exact SVG text helper from payload2_lifted.js:7943-7980:
// createElementNS("http://www.w3.org/2000/svg", "text"), set x/y/style constants,
// set style.font from arg_0, class "wfYoN3", and textContent = arg_0.

export default basicTest({
	name: "cf-svg-text-wfyo-style-helper",
	js: `
    const font = "16px runway-serif";
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "32");
    text.setAttribute("y", "32");
    text.style.fontSize = "150px !important";
    text.style.height = "auto";
    text.style.position = "absolute !important";
    text.style.transform = "scale(1.000998)";
    text.style.font = font;
    text.setAttribute("class", "wfYoN3");
    text.textContent = font;

    const observed = {
      namespaceURI: text.namespaceURI,
      tagName: text.tagName,
      x: text.getAttribute("x"),
      y: text.getAttribute("y"),
      className: text.getAttribute("class"),
      textContent: text.textContent,
      styleFont: text.style.font,
      styleFontSize: text.style.fontSize,
      styleHeight: text.style.height,
      stylePosition: text.style.position,
      styleTransform: text.style.transform,
      cssText: text.style.cssText,
    };

    assert(observed.namespaceURI === "http://www.w3.org/2000/svg", "SVG namespace mismatch");
    assert(observed.x === "32" && observed.y === "32", "SVG x/y attributes mismatch");
    assert(observed.className === "wfYoN3", "SVG class mismatch");
    assert(observed.textContent === font, "SVG textContent mismatch");
    assertConsistent("svg-text-wfyo-style-helper", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_159017_222 (line 7820-7877):
//   1. createElementNS("http://www.w3.org/2000/svg", "svg")
//   2. createElementNS("http://www.w3.org/2000/svg", "g")
//   3. createElementNS("http://www.w3.org/2000/svg", "text")
//   → checks SVG namespace handling
//
// p2_func_158162_155 (line 7835):
//   1. createElement("template")
//   2. template.content → check DocumentFragment
//
// p2_func_161737_91 (line 6342, 6364):
//   1. createElement("a")
//   2. a.href = URL → parse URL components
//
// p2_func_71789_5 (line 20309-20381):
//   1. createElement("input") → check value property
//   2. createElement("textarea") → check value property
//   3. createElement("option") → check instance type
//
// p2_func_275120_109 (line 20526+):
//   1. createElement("p")
//   2. createElement("style") → CSSStyleSheet check
//   3. createElement("span")

export default basicTest({
  name: "cf-dom-creation",
  js: `
    // SVG elements with proper namespace (p2_func_159017_222)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    assert(svg.namespaceURI === "http://www.w3.org/2000/svg",
      "createElementNS('svg') should have SVG namespace");

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    assert(g.namespaceURI === "http://www.w3.org/2000/svg",
      "createElementNS('g') should have SVG namespace");
    assert(g.tagName.toLowerCase() === "g",
      "createElementNS('g') tagName should be 'g'");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    assert(text.namespaceURI === "http://www.w3.org/2000/svg",
      "createElementNS('text') should have SVG namespace");

    // HTML template element (p2_func_158162_155)
    const tmpl = document.createElement("template");
    assert(tmpl instanceof HTMLTemplateElement,
      "createElement('template') should create HTMLTemplateElement");
    assert(tmpl.content instanceof DocumentFragment,
      "template.content should be a DocumentFragment");
    assert(tmpl.content.childNodes.length === 0,
      "empty template.content should have 0 children");

    // Anchor element for URL parsing (p2_func_161737_91)
    const a = document.createElement("a");
    a.href = "https://example.com:8080/path?q=1#hash";
    assert(a.hostname === "example.com",
      "anchor.hostname should parse correctly, got: " + a.hostname);
    assert(a.pathname === "/path",
      "anchor.pathname should parse correctly, got: " + a.pathname);
    assert(a.port === "8080",
      "anchor.port should parse correctly, got: " + a.port);
    assert(a.hash === "#hash",
      "anchor.hash should parse correctly, got: " + a.hash);

    // Form elements (p2_func_71789_5)
    const input = document.createElement("input");
    assert(typeof input.value === "string",
      "input.value should be a string");
    input.value = "test";
    assert(input.value === "test",
      "input.value should be settable");

    const textarea = document.createElement("textarea");
    assert(typeof textarea.value === "string",
      "textarea.value should be a string");

    const option = document.createElement("option");
    assert(option instanceof HTMLOptionElement,
      "createElement('option') should create HTMLOptionElement");

    // Style element (p2_func_275120_109)
    const style = document.createElement("style");
    assert(style instanceof HTMLStyleElement,
      "createElement('style') should create HTMLStyleElement");
    style.textContent = "div { color: red; }";
    document.head.appendChild(style);
    assert(style.sheet instanceof CSSStyleSheet,
      "style.sheet should be a CSSStyleSheet when in document");
    document.head.removeChild(style);
  `,
});
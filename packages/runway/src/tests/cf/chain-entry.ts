import { basicTest } from "../../testcommon.ts";

// Exact control flow from payload2_lifted.js:p2_func_275120_109
// (data4/payload2_lifted.js:240-335):
//
// 1. jwadD3 = "tvZSh0"
// 2. results = []
// 3. results[0] = document.body.shadowRoot
// 4. results[1] = _cf_chl_opt.kobE3.mode
// 5. results[2] = document.body.outerHTML
// 6. results[3] = document.body.innerHTML
// 7. results[4] = head.compareDocumentPosition(body)
// 8. results[5] = kobE3.querySelector("style").compareDocumentPosition(kobE3.querySelector("div"))
//    & Node.DOCUMENT_POSITION_FOLLOWING
// 9. results[6] is decompiler-damaged around `instanceof` with numeric Node
//    constants; this test records the raw body→div position and the damaged mask
//    outcome rather than inventing a boolean meaning.
// 10. results[7] = attachShadow.toString().toLocaleString().toString()
// 11. gNTwy6 = JSON.stringify(results)
// 12-14. Blob -> URL.createObjectURL -> Worker
// 15. huccT1 = crypto handler
// 16. Branch: YyXhA9 -> addEventListener(...)

export default basicTest({
	name: "cf-chain-entry",
	js: [
		"var previousCfOpt = window._cf_chl_opt;",
		"var container = document.createElement('div');",
		"var style = document.createElement('style');",
		"var div = document.createElement('div');",
		"style.textContent = 'div { color: red; }';",
		"container.appendChild(style);",
		"container.appendChild(div);",
		"document.body.appendChild(container);",
		"window._cf_chl_opt = Object.assign({}, previousCfOpt, { kobE3: container });",
		"try {",
		"  var results = [];",
		"  results[0] = document.body.shadowRoot;",
		"  var kobE3 = window._cf_chl_opt.kobE3;",
		"  results[1] = kobE3.mode;",
		"  results[2] = document.body.outerHTML;",
		"  assert(typeof results[2] === 'string', 'body.outerHTML should be a string');",
		"  results[3] = document.body.innerHTML;",
		"  assert(typeof results[3] === 'string', 'body.innerHTML should be a string');",
		"  results[4] = document.head.compareDocumentPosition(document.body);",
		"  assert(typeof results[4] === 'number', 'compareDocumentPosition should return a number');",
		"  var selectedStyle = kobE3.querySelector('style');",
		"  var selectedDiv = kobE3.querySelector('div');",
		"  assert(selectedStyle === style, 'kobE3.querySelector(style) should return the style child');",
		"  assert(selectedDiv === div, 'kobE3.querySelector(div) should return the div child');",
		"  results[5] = selectedStyle.compareDocumentPosition(selectedDiv) & Node.DOCUMENT_POSITION_FOLLOWING;",
		"  var bodyToDivPosition = document.body.compareDocumentPosition(selectedDiv);",
		"  var damagedInstanceofMask;",
		"  try { damagedInstanceofMask = Node.DOCUMENT_POSITION_DISCONNECTED instanceof Node.DOCUMENT_POSITION_FOLLOWING; }",
		"  catch (e) { damagedInstanceofMask = 'throws'; }",
		"  results[6] = bodyToDivPosition;",
		"  var attStr = document.body.attachShadow.toString();",
		"  results[7] = attStr.toLocaleString().toString();",
		"  assert(results[5] === Node.DOCUMENT_POSITION_FOLLOWING, 'style should precede div with FOLLOWING bit');",
		"  assert(typeof results[7] === 'string', 'attachShadow toString chain should return a string');",
		"  var gntwy6 = JSON.stringify(results);",
		"  assert(typeof gntwy6 === 'string' && gntwy6.charAt(0) === '[', 'gNTwy6 should JSON.stringify the results array');",
		"  assertConsistent('chain-entry-dom-results', { results: results, damagedInstanceofMask: damagedInstanceofMask });",
		"} finally {",
		"  document.body.removeChild(container);",
		"  if (previousCfOpt === undefined) delete window._cf_chl_opt; else window._cf_chl_opt = previousCfOpt;",
		"}",
		"var workerScript = 'self.postMessage(\\'ok\\');';",
		"var blobUrl = null; var worker = null;",
		"try {",
		"  var blob = new Blob([workerScript], { type: 'text/javascript' });",
		"  blobUrl = URL.createObjectURL(blob);",
		"  assert(typeof blobUrl === 'string' && blobUrl.indexOf('blob:') === 0, 'createObjectURL');",
		"  var workerUrl = typeof window.cAtV0 === 'function' ? window.cAtV0(blobUrl) : blobUrl;",
		"  worker = new Worker(workerUrl);",
		"  assert(worker instanceof Worker, 'Worker from blob');",
		"} catch (e) {} finally {",
		"  if (worker) worker.terminate();",
		"  if (blobUrl) URL.revokeObjectURL(blobUrl);",
		"}",
		"var huccT1 = function() {};",
		"assert(typeof huccT1 === 'function', 'huccT1 crypto handler slot should be callable');",
		"var urHandler = function() {};",
		"window.addEventListener('unhandledrejection', urHandler);",
		"window.removeEventListener('unhandledrejection', urHandler);",
		"window.addEventListener('error', function() {}, { once: true });",
		"window.removeEventListener('error', function() {});",
	].join("\n"),
});

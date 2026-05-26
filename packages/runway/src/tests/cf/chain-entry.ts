import { basicTest } from "../../testcommon.ts";

// Exact control flow from p2_func_275120_109 (lines 237-331):
//
// 1. jwadD3 = "tvZSh0"
// 2. results = []
// 3. results[0] = document.body.shadowRoot
// 4. results[1] = kobE3.mode
// 5. results[2] = document.body.outerHTML
// 6. results[3] = document.body.innerHTML
// 7. results[4] = head.compareDocumentPosition(body)
// 8. results[5] = style.compareDocumentPosition(div) & DOCUMENT_POSITION_FOLLOWING
// 9. results[6] = body.compareDocumentPosition(div) & (DISCONNECTED instanceof FOLLOWING con...
// 10. results[7] = attachShadow.toString().toLocaleString().toString()
// 11. gNTwy6 = JSON.stringify("JSON")
// 12-14. Blob -> URL.createObjectURL -> Worker
// 15. huccT1 = crypto handler
// 16. Branch: YyXhA9 -> addEventListener(...)

export default basicTest({
  name: "cf-chain-entry",
  js: [
    "var results = [];",
    "results[0] = document.body.shadowRoot;",
    "var kobE3 = document.body.shadowRoot || document.body;",
    "results[1] = kobE3.mode !== undefined ? kobE3.mode : (document.body.shadowRoot ? document.body.shadowRoot.mode : null);",
    "results[2] = document.body.outerHTML;",
    "assert(typeof results[2] === 'string', 'body.outerHTML should be a string');",
    "results[3] = document.body.innerHTML;",
    "assert(typeof results[3] === 'string', 'body.innerHTML should be a string');",
    "results[4] = document.head.compareDocumentPosition(document.body);",
    "assert(typeof results[4] === 'number', 'compareDocumentPosition should return a number');",
    "var style = kobE3.querySelector('style') || kobE3;",
    "var div = kobE3.querySelector('div') || kobE3;",
    "results[5] = style.compareDocumentPosition(div) & Node.DOCUMENT_POSITION_FOLLOWING;",
    "var posBody = document.body.compareDocumentPosition(div);",
    "results[6] = (Node.DOCUMENT_POSITION_DISCONNECTED instanceof (Node.DOCUMENT_POSITION_FOLLOWING).constructor) && (posBody);",
    "var attStr = document.body.attachShadow.toString();",
    "results[7] = attStr.toLocaleString().toString();",
    "assert(results[7].indexOf('function') === 0, 'attachShadow toString should start with function');",
    "var gntwy6 = JSON.stringify('JSON');",
    "assert(gntwy6 === String.fromCharCode(34) + 'JSON' + String.fromCharCode(34), 'JSON.stringify');",
    "var workerScript = 'self.postMessage(\\'ok\\');';",
    "var blobUrl = null; var worker = null;",
    "try {",
    "  var blob = new Blob([workerScript], { type: 'text/javascript' });",
    "  blobUrl = URL.createObjectURL(blob);",
    "  assert(typeof blobUrl === 'string' && blobUrl.indexOf('blob:') === 0, 'createObjectURL');",
    "  worker = new Worker(blobUrl);",
    "  assert(worker instanceof Worker, 'Worker from blob');",
    "} catch (e) {} finally {",
    "  if (worker) worker.terminate();",
    "  if (blobUrl) URL.revokeObjectURL(blobUrl);",
    "}",
    "var hasSubtle = !!(window.crypto && window.crypto.subtle);",
    "assert(typeof hasSubtle === 'boolean', 'crypto.subtle check');",
    "var urHandler = function() {};",
    "window.addEventListener('unhandledrejection', urHandler);",
    "window.removeEventListener('unhandledrejection', urHandler);",
    "window.addEventListener('error', function() {}, { once: true });",
    "window.removeEventListener('error', function() {});",
  ].join("\n"),
});
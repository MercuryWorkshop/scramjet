import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted probe:
// internal-cf-reverse/data4/payload2_lifted.js:242-308
//   document.body.shadowRoot
//   _cf_chl_opt.kobE3.mode
//   document.body.outerHTML / innerHTML
//   document.head.compareDocumentPosition(document.body)
//   _cf_chl_opt.kobE3.querySelector("style").compareDocumentPosition(div)
//     & Node.DOCUMENT_POSITION_FOLLOWING
//   document.body.compareDocumentPosition(div)
//     (the lifted slot-6 mask is decompiler-damaged around instanceof/bitwise ops,
//      so this records the raw observable position value instead of inventing it)
//   document.body.attachShadow.toString().toLocaleString().toString()

export default basicTest({
	name: "cf-dom-checks",
	js: `
		const previousCfOpt = window._cf_chl_opt;
		const container = document.createElement("div");
		const styleEl = document.createElement("style");
		const childDiv = document.createElement("div");
		styleEl.textContent = "div { color: red; }";
		container.appendChild(styleEl);
		container.appendChild(childDiv);
		document.body.appendChild(container);

		try {
			window._cf_chl_opt = Object.assign({}, previousCfOpt, { kobE3: container });

			const bodyToChildPosition = document.body.compareDocumentPosition(childDiv);

			assert(typeof document.body.attachShadow === "function",
				"document.body.attachShadow should be a function");

			const snapshot = [
				document.body.shadowRoot,
				window._cf_chl_opt.kobE3.mode,
				document.body.outerHTML,
				document.body.innerHTML,
				document.head.compareDocumentPosition(document.body),
				styleEl.compareDocumentPosition(childDiv) & Node.DOCUMENT_POSITION_FOLLOWING,
				bodyToChildPosition,
				document.body.attachShadow.toString().toLocaleString().toString(),
			];

			assertConsistent("dom-probe-snapshot", JSON.stringify(snapshot));
		} finally {
			if (previousCfOpt === undefined) {
				delete window._cf_chl_opt;
			} else {
				window._cf_chl_opt = previousCfOpt;
			}
			document.body.removeChild(container);
		}
	`,
});

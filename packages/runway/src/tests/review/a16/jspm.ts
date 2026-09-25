import { site } from "./lib.ts";

const deps = {
	"@lit/reactive-element":
		"https://ga.jspm.io/npm:@lit/reactive-element@2.1.2/reactive-element.js",
	"lit-element/lit-element.js":
		"https://ga.jspm.io/npm:lit-element@4.2.2/lit-element.js",
	"lit-html": "https://ga.jspm.io/npm:lit-html@3.3.3/lit-html.js",
	"lit-html/is-server.js": "https://ga.jspm.io/npm:lit-html@3.3.3/is-server.js",
};
const lit = "https://ga.jspm.io/npm:lit@3.1.0/index.js";

const litPage = (
	map: object
) => `<!doctype html><html><head><script type="importmap">${JSON.stringify(map)}</script></head><body><x-el></x-el>
<script type="module">
window.__err = [];
import("lit").then(({ LitElement, html }) => {
  customElements.define("x-el", class extends LitElement { render() { return html\`<b>lit ok</b>\`; } });
}, (e) => { window.__err.push(String(e.message).slice(0, 80)); });
runTest(async () => {
  for (let i = 0; i < 100; i++) { const el = document.querySelector("x-el"); if (el && el.shadowRoot && el.shadowRoot.textContent.includes("lit ok")) break; await new Promise(r => setTimeout(r, 50)); }
  const el = document.querySelector("x-el");
  assertConsistent("rendered", !!(el && el.shadowRoot && el.shadowRoot.textContent.includes("lit ok")));
}, true);
</script></body></html>`;

// static-import variant, so #7 (import() of a parser-map specifier) is not in the way
const litStaticPage = (
	map: object
) => `<!doctype html><html><head><script type="importmap">${JSON.stringify(map)}</script></head><body><x-el></x-el>
<script type="module">
import { LitElement, html } from "lit";
customElements.define("x-el", class extends LitElement { render() { return html\`<b>lit ok</b>\`; } });
</script>
<script>
runTest(async () => {
  for (let i = 0; i < 100; i++) { const el = document.querySelector("x-el"); if (el && el.shadowRoot && el.shadowRoot.textContent.includes("lit ok")) break; await new Promise(r => setTimeout(r, 50)); }
  const el = document.querySelector("x-el");
  assertConsistent("rendered", !!(el && el.shadowRoot && el.shadowRoot.textContent.includes("lit ok")));
}, true);
</script></body></html>`;

export default [
	site("rv16-jspm-lit-scoped-static", {
		"/": litStaticPage({
			imports: {
				lit,
			},
			scopes: {
				"https://ga.jspm.io/": deps,
			},
		}),
	}),
	site("rv16-jspm-lit-flat-static", {
		"/": litStaticPage({
			imports: {
				lit,
				...deps,
			},
		}),
	}),
];

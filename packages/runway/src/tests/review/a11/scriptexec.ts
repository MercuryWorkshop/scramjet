import { probeTest } from "./lib.ts";

const S = (k: string) =>
	`window.X=window.X||{};window.X[${JSON.stringify(k)}]=(window.X[${JSON.stringify(k)}]||0)+1;window.L=window.L||{};window.L[${JSON.stringify(k)}]=location.pathname;`;
const mk = (k: string) =>
	`(() => { const s = document.createElement('script'); s.textContent = ${JSON.stringify(S(k))}; return s; })()`;
const res = (k: string) =>
	`await new Promise(r => setTimeout(r, 30)); return [window.X && window.X[${JSON.stringify(k)}], window.L && window.L[${JSON.stringify(k)}]];`;

export default [
	probeTest({
		name: "rv11-script-exec-paths",
		body: `<div id=host></div><script id=parsed>${S("parsed")}</script>`,
		probes: {
			replaceChildren: `document.getElementById('host').replaceChildren(${mk("rc")}); ${res("rc")}`,
			before: `document.getElementById('host').before(${mk("bf")}); ${res("bf")}`,
			after_mixed: `document.getElementById('host').after('txt', ${mk("af")}, 'txt2'); ${res("af")}`,
			prepend_frag: `const f = document.createDocumentFragment(); f.append(${mk("pf")}); document.body.prepend(f); ${res("pf")}`,
			insertAdjacentElement: `document.getElementById('host').insertAdjacentElement('beforeend', ${mk("iae")}); ${res("iae")}`,
			replaceWith: `const d = document.createElement('div'); document.body.append(d); d.replaceWith(${mk("rw")}); ${res("rw")}`,
			replaceChild: `const d = document.createElement('div'); document.body.append(d); document.body.replaceChild(${mk("rch")}, d); ${res("rch")}`,
			moveBefore: `if (!Element.prototype.moveBefore) return 'n/a'; const s = ${mk("mb")}; document.body.append(s); document.body.moveBefore(s, document.body.firstChild); ${res("mb")}`,
			clone_parsed: `const c = document.getElementById('parsed').cloneNode(true); document.body.append(c); ${res("parsed")}`,
			clone_fresh_detached: `const s = ${mk("cfd")}; const c = s.cloneNode(true); document.body.append(c); ${res("cfd")}`,
			reinsert_same: `const s = ${mk("ri")}; document.body.append(s); s.remove(); document.body.append(s); ${res("ri")}`,
			text_after_insert: `const s = document.createElement('script'); document.body.append(s); s.text = ${JSON.stringify(S("tai"))}; ${res("tai")}`,
			append_textnode_after_insert: `const s = document.createElement('script'); document.body.append(s); s.appendChild(document.createTextNode(${JSON.stringify(S("atn"))})); ${res("atn")}`,
			two_textnodes: `const s = document.createElement('script'); s.appendChild(document.createTextNode('window.X=window.X||{};')); s.appendChild(document.createTextNode(${JSON.stringify(S("ttn"))})); document.body.append(s); ${res("ttn")}`,
			domparser_import: `const d = new DOMParser().parseFromString('<script>${S("dpi").replace(/"/g, "&quot;").replace(/'/g, "\\'")}<\\/script>', 'text/html'); document.body.append(document.importNode(d.querySelector('script'), true)); ${res("dpi")}`,
			domparser_adopt: `const d = new DOMParser().parseFromString('<script>${S("dpa").replace(/'/g, "\\'")}<\\/script>', 'text/html'); document.body.append(document.adoptNode(d.querySelector('script'))); ${res("dpa")}`,
			domparser_recreate: `const d = new DOMParser().parseFromString('<script>${S("dpr").replace(/'/g, "\\'")}<\\/script>', 'text/html'); const o = d.querySelector('script'); const s = document.createElement('script'); s.textContent = o.textContent; document.body.append(s); ${res("dpr")}`,
			createHTMLDocument_move: `const d = document.implementation.createHTMLDocument(''); d.body.innerHTML = '<script>${S("chd").replace(/'/g, "\\'")}<\\/script>'; document.body.append(d.body.firstChild); ${res("chd")}`,
			range_fragment: `const fr = document.createRange().createContextualFragment('<script>${S("ccf").replace(/'/g, "\\'")}<\\/script>'); document.body.append(fr); ${res("ccf")}`,
			template_content: `const t = document.createElement('template'); t.innerHTML = '<script>${S("tpl").replace(/'/g, "\\'")}<\\/script>'; document.body.append(t.content.cloneNode(true)); ${res("tpl")}`,
			innerHTML_noexec: `document.getElementById('host').innerHTML = '<script>${S("ih").replace(/'/g, "\\'")}<\\/script>'; ${res("ih")}`,
			setHTMLUnsafe: `if (!Element.prototype.setHTMLUnsafe) return 'n/a'; document.getElementById('host').setHTMLUnsafe('<script>${S("shu").replace(/'/g, "\\'")}<\\/script>'); ${res("shu")}`,
			docwrite_iframe: `const f = document.createElement('iframe'); document.body.append(f); f.contentDocument.open(); f.contentDocument.write('<script>parent.X=parent.X||{};parent.X.dw=(parent.X.dw||0)+1; parent.L=parent.L||{}; parent.L.dw=location.href<\\/script>'); f.contentDocument.close(); ${res("dw")}`,
			module_inline: `const s = document.createElement('script'); s.type = 'module'; s.textContent = ${JSON.stringify(S("mod"))}; document.body.append(s); await new Promise(r => setTimeout(r, 200)); return [window.X && window.X.mod, window.L && window.L.mod];`,
			nomodule: `const s = document.createElement('script'); s.noModule = true; s.textContent = ${JSON.stringify(S("nm"))}; document.body.append(s); ${res("nm")}`,
			type_json: `const s = document.createElement('script'); s.type = 'application/json'; s.textContent = '{"a":1}'; document.body.append(s); return [JSON.parse(s.textContent).a, s.text];`,
			type_ld: `const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = '{"@context":"https://schema.org"}'; document.body.append(s); return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@context'];`,
			type_template: `const s = document.createElement('script'); s.type = 'text/x-template'; s.id='xt'; s.innerHTML = '<div :href="u">{{ location }}</div>'; document.body.append(s); return document.getElementById('xt').innerHTML;`,
			event_type: `const s = document.createElement('script'); s.setAttribute('event', 'onload'); s.setAttribute('for', 'window'); s.textContent = ${JSON.stringify(S("evt"))}; document.body.append(s); ${res("evt")}`,
			currentScript: `const s = document.createElement('script'); s.id = 'cs1'; s.textContent = 'window.__cs = document.currentScript && document.currentScript.id'; document.body.append(s); return window.__cs;`,
		},
	}),
];

import { probeTest } from "./lib.ts";

// cookie-consent style script activation: blocked scripts are emitted with a
// non-JS type and activated later by various techniques
const blocked = (id: string, extra = "") =>
	`<script type="text/plain" data-cat="stats" id="${id}" ${extra}>window.ran = window.ran || {}; window.ran["${id}"] = (window.ran["${id}"]||0) + 1; window.loc_${id} = location.pathname;</script>`;

export default [
	probeTest({
		name: "rv11-consent-activation",
		body:
			blocked("b1") +
			blocked("b2") +
			blocked("b3") +
			blocked("b4") +
			blocked("b5") +
			blocked("b6") +
			blocked("b7") +
			blocked("b8") +
			`<script type="text/plain" data-src="/ext-consent.js" id="s1"></script><script type="text/plain" src="/ext-consent2.js" id="s2"></script>` +
			`<div id=tpl-host><template id=tpl><script>window.ran = window.ran || {}; window.ran.tpl = (window.ran.tpl||0)+1;</script></template></div>`,
		probes: {
			a_clone_textContent: `const o = document.getElementById('b1'); const s = document.createElement('script'); for (const a of o.attributes) if (a.name !== 'type') s.setAttribute(a.name, a.value); s.textContent = o.textContent; o.replaceWith(s); return [window.ran && window.ran.b1, window.loc_b1];`,
			b_type_then_clone: `const o = document.getElementById('b2'); o.type = 'text/javascript'; const c = o.cloneNode(true); o.parentNode.replaceChild(c, o); return [window.ran && window.ran.b2, window.loc_b2];`,
			c_setattr_type_detach_reappend: `const o = document.getElementById('b3'); const p = o.parentNode, n = o.nextSibling; o.remove(); o.setAttribute('type', 'text/javascript'); p.insertBefore(o, n); return [window.ran && window.ran.b3, 'note: already-started? bare decides'];`,
			d_innerHTML_copy: `const o = document.getElementById('b4'); const s = document.createElement('script'); s.innerHTML = o.innerHTML; document.body.appendChild(s); return [window.ran && window.ran.b4, window.loc_b4];`,
			e_text_copy: `const o = document.getElementById('b5'); const s = document.createElement('script'); s.text = o.text; document.head.appendChild(s); return [window.ran && window.ran.b5, window.loc_b5];`,
			f_removeAttr_type_clone: `const o = document.getElementById('b6'); o.removeAttribute('type'); const c = document.createElement('script'); c.textContent = o.textContent; o.after(c); return [window.ran && window.ran.b6, window.loc_b6];`,
			g_readback: `const o = document.getElementById('b7'); return [o.textContent === o.innerHTML, o.text.length, o.textContent.slice(0, 40), o.childNodes.length];`,
			h_outerHTML_reparse: `const o = document.getElementById('b8'); const d = document.createElement('div'); d.innerHTML = o.outerHTML.replace('text/plain', 'text/javascript'); const s = document.createElement('script'); s.textContent = d.firstChild.textContent; document.body.appendChild(s); return [window.ran && window.ran.b8, window.loc_b8];`,
			i_datasrc: `const o = document.getElementById('s1'); const s = document.createElement('script'); s.src = o.dataset.src; const p = new Promise(r => { s.onload = () => r('load'); s.onerror = () => r('error'); }); document.body.appendChild(s); return [await p, window.extConsent];`,
			j_src_type_swap: `const o = document.getElementById('s2'); const s = document.createElement('script'); s.src = o.src; const p = new Promise(r => { s.onload = () => r('load'); s.onerror = () => r('error'); }); o.replaceWith(s); return [await p, window.extConsent2, o.getAttribute('src'), o.src];`,
			k_template_clone: `const t = document.getElementById('tpl'); document.body.appendChild(t.content.cloneNode(true)); await new Promise(r => setTimeout(r, 50)); return window.ran && window.ran.tpl;`,
			l_template_import: `const t = document.getElementById('tpl'); document.body.appendChild(document.importNode(t.content, true)); await new Promise(r => setTimeout(r, 50)); return window.ran && window.ran.tpl;`,
		},
		extra: (req: any, res: any) => {
			if (req.url.startsWith("/ext-consent2.js")) {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end("window.extConsent2 = location.pathname;");
				return true;
			}
			if (req.url.startsWith("/ext-consent.js")) {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end("window.extConsent = location.pathname;");
				return true;
			}
			return false;
		},
	}),
];

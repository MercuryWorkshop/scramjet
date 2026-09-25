import { probeTest } from "./lib.ts";

const css = `/*!sc*/ .a{background:url(/img/a.png) no-repeat; } .b{background-image:url("rel/b.png")} .c::before{content:"url(/nope.png)"} @font-face{font-family:X;src:url(/f.woff2) format("woff2")} .d{--bg:url('data:image/png;base64,AAAA')} .e{background:url(https://cdn.example.com/e.png)}`;
const J = JSON.stringify(css);
const probes: Record<string, string> = {
	parsed_textContent: `const s=document.getElementById('ps'); return s.textContent===${J} ? 'SAME' : s.textContent;`,
	parsed_innerHTML: `const s=document.getElementById('ps'); return s.innerHTML===${J} ? 'SAME' : s.innerHTML;`,
	parsed_data: `const s=document.getElementById('ps'); return s.firstChild.data===${J} ? 'SAME' : s.firstChild.data;`,
	parsed_innerText: `const s=document.getElementById('ps'); return s.innerText===${J} ? 'SAME' : s.innerText;`,
	parsed_rule0: `const s=document.getElementById('ps'); return [...s.sheet.cssRules].map(r=>r.cssText).join(' | ');`,
	dyn_textContent: `const s=document.createElement('style'); s.textContent=${J}; document.head.appendChild(s); return [s.textContent===${J} ? 'SAME' : s.textContent, s.sheet.cssRules.length];`,
	dyn_innerHTML: `const s=document.createElement('style'); s.innerHTML=${J}; document.head.appendChild(s); return [s.innerHTML===${J} ? 'SAME' : s.innerHTML, s.textContent===${J} ? 'SAME' : s.textContent];`,
	dyn_appendText: `const s=document.createElement('style'); document.head.appendChild(s); s.appendChild(document.createTextNode('.x{color:red}')); s.appendChild(document.createTextNode('.y{background:url(/y.png)}')); return [s.childNodes.length, s.textContent, s.lastChild.data, s.sheet.cssRules.length];`,
	sc_rehydrate_like: `const s=document.createElement('style'); s.setAttribute('data-styled','active'); s.textContent='.g1{color:red;}/*!sc*/\\ndata-styled.g1[id="sc-a"]{content:"b,"}/*!sc*/\\n'; document.head.appendChild(s); const t=s.textContent; return [t.split('/*!sc*/').length, t.includes('data-styled.g1[id="sc-a"]{content:"b,"}')];`,
	outer_style: `const s=document.createElement('style'); s.textContent='.o{background:url(/o.png)}'; return s.outerHTML;`,
	body_innerHTML_roundtrip: `const d=document.createElement('div'); d.innerHTML='<style>.r{background:url(/r.png)}</style><p style="background:url(/p.png)">x</p>'; return d.innerHTML;`,
	style_attr_read: `const p=document.createElement('p'); p.setAttribute('style','background:url(/sa.png)'); return [p.getAttribute('style'), p.style.backgroundImage, p.style.cssText, p.outerHTML];`,
	cssText_set_read: `const p=document.createElement('p'); p.style.cssText='background-image:url(/ct.png); color:red'; return [p.style.cssText, p.getAttribute('style')];`,
	setProperty_read: `const p=document.createElement('p'); p.style.setProperty('--u','url(/cv.png)'); p.style.setProperty('background-image','url(rel.png)'); return [p.style.getPropertyValue('--u'), p.style.getPropertyValue('background-image'), p.getAttribute('style')];`,
	insertRule_read: `const s=document.createElement('style'); document.head.appendChild(s); s.sheet.insertRule('.ir{background:url(/ir.png)}',0); return [s.sheet.cssRules[0].cssText, s.sheet.cssRules[0].style.backgroundImage, s.textContent];`,
	adopted: `const sh=new CSSStyleSheet(); sh.replaceSync('.ad{background:url(/ad.png)}'); document.adoptedStyleSheets=[...document.adoptedStyleSheets, sh]; return sh.cssRules[0].cssText;`,
	style_media_attr: `const s=document.createElement('style'); s.media='(min-width: 1px)'; s.textContent='.m{color:red}'; document.head.appendChild(s); return [s.media, s.getAttribute('media'), s.sheet.media.mediaText];`,
	link_css: `const l=document.createElement('link'); l.rel='stylesheet'; l.href='/lc.css'; const p=new Promise(r=>{l.onload=()=>r('load'); l.onerror=()=>r('error');}); document.head.appendChild(l); const x=await p; return [x, l.sheet && [...l.sheet.cssRules].map(r=>r.cssText).join('|'), l.href];`,
};

export default [
	probeTest({
		name: "rv10-style-text",
		head: `<style id=ps>${css}</style>`,
		probes,
		extra: (req, res) => {
			if (req.url.startsWith("/lc.css")) {
				res.writeHead(200, {
					"Content-Type": "text/css",
				});
				res.end(".lc{background:url(img/lc.png)} @import url('/imp.css');");
				return true;
			}
			return false;
		},
	}),
];

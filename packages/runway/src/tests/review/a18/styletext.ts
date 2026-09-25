import { probeTest } from "./harness.ts";

// `<style>` text read back through every serialiser, for parsed and
// script-built sheets.
const mkstyle = `const s=document.createElement('style'); s.textContent='.stx{background-image:url(img/'+R+'-stx.png)}'; document.head.appendChild(s);`;
const probes: Record<string, string> = {
	parsed_textContent: `const s=document.getElementById('st1'); return [s.textContent, s.innerHTML, s.outerHTML, s.firstChild.data, s.firstChild.length];`,
	parsed_serializer: `const s=document.getElementById('st1'); return [new XMLSerializer().serializeToString(s), s.cloneNode(true).textContent, document.importNode(s,true).textContent];`,
	parsed_head_innerHTML: `return [document.head.innerHTML.includes('/~/sj/'), document.head.innerHTML.match(/\\.st1\\{[^}]*\\}/)[0]];`,
	parsed_range: `const s=document.getElementById('st1'); const r=document.createRange(); r.selectNodeContents(s); return [r.toString(), r.cloneContents().textContent];`,
	built_outerHTML: `${mkstyle} return [s.outerHTML, new XMLSerializer().serializeToString(s)];`,
	built_parent_innerHTML: `${mkstyle} const h=document.createElement('div'); h.appendChild(s.cloneNode(true)); return [h.innerHTML];`,
	built_multi_outer: `const s=document.createElement('style'); s.append('.m1{background-image:url(img/'+R+'-m1.png)}', '.m2{color:red}'); document.head.appendChild(s); return [s.outerHTML, s.childNodes.length, [...s.childNodes].map(n=>n.data)];`,
	built_split: `const s=document.createElement('style'); s.textContent='.sp1{color:red}.sp2{background-image:url(img/'+R+'-sp2.png)}'; document.head.appendChild(s); const t=s.firstChild.splitText(15); mk().className='sp2'; return [s.childNodes.length, s.firstChild.data, t.data, s.sheet.cssRules.length];`,
	built_normalize: `const s=document.createElement('style'); s.append('.n1{color:red}', '.n2{background-image:url(img/'+R+'-n2.png)}'); document.head.appendChild(s); s.normalize(); mk().className='n2'; return [s.childNodes.length, s.firstChild.data, s.sheet.cssRules.length];`,
	built_replaceData: `const s=document.createElement('style'); s.textContent='.rd{color:red}'; document.head.appendChild(s); s.firstChild.replaceData(4, 9, 'background-image:url(img/'+R+'-rd.png)'); mk().className='rd'; return [s.firstChild.data, s.sheet.cssRules[0] && s.sheet.cssRules[0].cssText];`,
	built_nodeValue: `const s=document.createElement('style'); s.appendChild(document.createTextNode('')); document.head.appendChild(s); s.firstChild.nodeValue='.nv{background-image:url(img/'+R+'-nv.png)}'; mk().className='nv'; return [s.firstChild.nodeValue, s.textContent];`,
	built_innerText: `const s=document.createElement('style'); document.head.appendChild(s); s.innerText='.it{background-image:url(img/'+R+'-it.png)}'; mk().className='it'; return [s.innerText, s.textContent];`,
	built_outerText_parent: `const h=mk(); h.innerHTML='<style>.ot{background-image:url(img/'+R+'-ot.png)}</style>'; mk().className='ot'; return [h.innerHTML, h.firstChild.textContent];`,
	built_insertAdjacent: `const h=mk(); h.insertAdjacentHTML('beforeend','<style>.ia{background-image:url(img/'+R+'-ia.png)}</style>'); mk().className='ia'; return [h.innerHTML];`,
	built_setHTMLUnsafe: `const h=mk(); if(!h.setHTMLUnsafe) return 'n/a'; h.setHTMLUnsafe('<style>.shu{background-image:url(img/'+R+'-shu.png)}</style>'); mk().className='shu'; return [h.innerHTML];`,
	built_range_create: `const h=mk(); const f=document.createRange().createContextualFragment('<style>.rc{background-image:url(img/'+R+'-rc.png)}</style>'); h.appendChild(f); mk().className='rc'; return [h.innerHTML];`,
	built_domparser: `const doc=new DOMParser().parseFromString('<style>.dp{background-image:url(img/'+R+'-dp.png)}</style>','text/html'); const s=doc.querySelector('style'); document.head.appendChild(document.adoptNode(s)); mk().className='dp'; return [s.textContent];`,
	built_template: `const t=document.createElement('template'); t.innerHTML='<style>.tp{background-image:url(img/'+R+'-tp.png)}</style>'; document.head.appendChild(t.content.cloneNode(true)); mk().className='tp'; return [t.innerHTML];`,
	shadow_style: `const h=mk(); const sr=h.attachShadow({mode:'open'}); sr.innerHTML='<style>.c{background-image:url(img/'+R+'-shs.png)}</style><div class=c style="width:4px;height:4px"></div>'; return [sr.innerHTML, sr.querySelector('style').textContent];`,
	svg_style_text: `const g=mksvg(); g.innerHTML='<style>.svs{fill:red; background-image:url(img/'+R+'-svs.png)}</style>'; mk().className='svs'; return [g.innerHTML, g.firstChild.textContent];`,
	style_move_between: `const a=document.createElement('style'); const b=document.createElement('style'); a.textContent='.mv1{color:red}'; b.textContent='.mv2{background-image:url(img/'+R+'-mv2.png)}'; document.head.append(a,b); a.appendChild(b.firstChild); mk().className='mv2'; return [a.textContent, b.textContent, a.sheet.cssRules.length, b.sheet.cssRules.length];`,
	text_out_of_style: `const s=document.createElement('style'); s.textContent='.oo{background-image:url(img/x.png)}'; document.head.appendChild(s); const t=s.firstChild; const p=mk('p'); p.appendChild(t); return [p.textContent, t.data, p.innerHTML];`,
};

export default [probeTest("rv18-styletext", probes)];

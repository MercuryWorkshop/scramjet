import { probeTest } from "./lib.ts";

const pre = `const f=document.createElement('iframe'); document.body.appendChild(f); const w=window[window.length-1]; const fd=w.document;`;
const probes: Record<string, string> = {
	appendChild: `${pre} const n=fd.createElement('b'); document.body.appendChild(n); return document.body.lastChild.nodeName;`,
	insertBefore: `${pre} const n=fd.createElement('b'); document.body.insertBefore(n, document.body.firstChild); return document.body.firstChild.nodeName;`,
	replaceChild: `${pre} const d=document.createElement('div'); const c=document.createElement('span'); d.appendChild(c); document.body.appendChild(d); d.replaceChild(fd.createElement('em'), c); return d.innerHTML;`,
	removeChild_foreignparent: `${pre} const b=fd.createElement('b'); fd.body.appendChild(b); fd.body.removeChild(b); return fd.body.childNodes.length;`,
	importNode: `${pre} const n=fd.createElement('b'); const m=document.importNode(n, true); return m.ownerDocument===document;`,
	adoptNode: `${pre} const n=fd.createElement('b'); const m=document.adoptNode(n); return m.ownerDocument===document;`,
	range_insertNode: `${pre} const p=document.createElement('p'); p.textContent='ab'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,1); r.insertNode(fd.createElement('i')); return p.innerHTML;`,
	setAttributeNode: `${pre} const a=fd.createAttribute('title'); a.value='x'; const e=document.createElement('div'); e.setAttributeNode(a); return e.getAttribute('title');`,
	getComputedStyle: `${pre} const e=fd.createElement('div'); fd.body.appendChild(e); return typeof getComputedStyle(e).display;`,
	contains: `${pre} const e=fd.createElement('div'); return document.body.contains(e);`,
	textNode_append: `${pre} const t=fd.createTextNode('hello'); document.body.appendChild(t); return document.body.lastChild.data;`,
	fragment_append: `${pre} const fr=fd.createDocumentFragment(); fr.appendChild(fd.createElement('u')); document.body.appendChild(fr); return document.body.lastChild.nodeName;`,
	parent_append_into_frame: `${pre} fd.body.appendChild(document.createElement('s')); return fd.body.lastChild.nodeName;`,
	frame_append_foreign_via_frame_proto: `${pre} w.Node.prototype.appendChild.call(fd.body, document.createElement('q')); return fd.body.lastChild.nodeName;`,
	dispatchEvent_foreign: `${pre} let got=0; document.body.addEventListener('x', ()=>got++); document.body.dispatchEvent(new w.Event('x')); return got;`,
	mo_observe_foreign: `${pre} const mo=new MutationObserver(()=>{}); mo.observe(fd.body, {childList:true}); return 'ok';`,
	blob_foreign: `${pre} const b=new w.Blob(['hi']); const u=URL.createObjectURL(b); const t=await (await fetch(u)).text(); return t;`,
	fetch_foreign_request: `${pre} const r=new w.Request('/echo/fr'); const t=await (await fetch(r)).text(); return t;`,
	formdata_foreign: `${pre} const fdd=new w.FormData(); fdd.append('a','1'); const r=await fetch('/echo/fd', {method:'POST', body:fdd}); return r.status;`,
	postMessage_foreign_transfer: `${pre} const mc=new w.MessageChannel(); postMessage('x','*',[mc.port1]); return 'ok';`,
	createObjectURL_foreign_file: `${pre} const file=new w.File(['a'],'a.txt'); return typeof URL.createObjectURL(file);`,
	headers_foreign: `${pre} const h=new w.Headers({'x-a':'1'}); const r=await fetch('/echo/h', {headers:h}); return r.status;`,
	after_foreign: `${pre} const d=document.createElement('div'); document.body.appendChild(d); d.after(fd.createElement('mark')); return d.nextSibling && d.nextSibling.nodeName;`,
	style_foreign_sheet: `${pre} const s=fd.createElement('style'); s.textContent='.x{color:red}'; document.head.appendChild(s); return !!s.sheet;`,
	script_foreign_run: `${pre} const s=fd.createElement('script'); s.textContent='window.__fs=location.host'; document.body.appendChild(s); return window.__fs===location.host;`,
	img_foreign_src: `${pre} const i=fd.createElement('img'); i.src='/fimg.png'; document.body.appendChild(i); return [i.getAttribute('src'), i.src.includes('/~/')];`,
};

export default [
	probeTest({
		name: "rv10-foreign-realm",
		probes,
	}),
];

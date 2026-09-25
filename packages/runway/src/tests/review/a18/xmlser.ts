import { probeTest } from "./harness.ts";

// Serialisers that don't go through the element layer: do they show the
// scramjet-attr-style mirror that develop now creates on every CSSOM write?
const probes: Record<string, string> = {
	svg_cssom_xmlser: `const s=mksvg(); const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); s.appendChild(r); r.style.fill='red'; r.style.opacity='0.5'; return [new XMLSerializer().serializeToString(s)];`,
	svg_setattr_xmlser: `const s=mksvg(); const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); s.appendChild(r); r.setAttribute('style','fill:red'); return [new XMLSerializer().serializeToString(s)];`,
	html_cssom_xmlser: `const d=mk(); d.style.color='red'; return [new XMLSerializer().serializeToString(d)];`,
	svg_cssom_outer: `const s=mksvg(); const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); s.appendChild(r); r.style.fill='red'; return [s.outerHTML];`,
	svg_cssom_attrs: `const s=mksvg(); s.style.fill='red'; return [s.attributes.length, [...s.attributes].map(a=>a.name), s.getAttributeNames(), s.hasAttributes()];`,
	svg_cssom_blob_img: `const s=mksvg(); s.setAttribute('xmlns','http://www.w3.org/2000/svg'); s.setAttribute('width','4'); s.setAttribute('height','4'); const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('width','4'); r.setAttribute('height','4'); s.appendChild(r); r.style.fill='rgb(255,0,0)'; const str=new XMLSerializer().serializeToString(s); const img=new Image(); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str); await img.decode(); const c=document.createElement('canvas'); c.width=4; c.height=4; const g=c.getContext('2d'); g.drawImage(img,0,0); return [Array.from(g.getImageData(1,1,1,1).data).join(','), str.includes('scramjet')];`,
	d3_like_export: `const s=mksvg(); for(let i=0;i<3;i++){ const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.style.setProperty('fill','steelblue'); c.setAttribute('r','2'); s.appendChild(c);} const out=new XMLSerializer().serializeToString(s); return [out.length, (out.match(/scramjet/g)||[]).length];`,
	range_cloneContents: `const h=mk(); const sp=document.createElement('span'); h.appendChild(sp); sp.style.color='red'; const r=document.createRange(); r.selectNodeContents(h); const f=r.cloneContents(); const t=document.createElement('div'); t.appendChild(f); return [t.innerHTML, t.firstChild.getAttributeNames()];`,
	clipboard_like: `const h=mk(); h.innerHTML='<b>x</b>'; h.firstChild.style.color='red'; const sel=getSelection(); const r=document.createRange(); r.selectNodeContents(h); sel.removeAllRanges(); sel.addRange(r); let html=''; const onCopy=e=>{ }; document.addEventListener('copy', onCopy); return [h.innerHTML];`,
};

export default [probeTest("rv18-xmlser", probes)];

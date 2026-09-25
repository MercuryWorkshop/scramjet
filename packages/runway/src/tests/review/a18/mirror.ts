import { probeTest } from "./harness.ts";

// The inline-style mirror (`scramjet-attr-style`) is created by the first
// CSSOM write on develop. Every later change to the style attribute that does
// not go through `touched` leaves getAttribute/outerHTML/selectors stale.
const probes: Record<string, string> = {
	// React: style={{width: 10, float: 'left'}} then float changes
	react_float: `const d=mk(); d.style.width='10px'; d.style.cssFloat='left'; return [d.getAttribute('style'), d.outerHTML, d.matches('[style*="float"]'), document.querySelectorAll('[style*="float: left"]').length];`,
	react_float_update: `const d=mk(); d.style.width='10px'; d.style.cssFloat='left'; d.style.width='11px'; d.style.cssFloat='right'; return [d.getAttribute('style')];`,
	react_float_clear: `const d=mk(); d.style.cssFloat='left'; d.style.width='10px'; d.style.cssFloat=''; return [d.getAttribute('style'), d.hasAttribute('style')];`,
	dashed_nonurl: `const d=mk(); d.style.width='10px'; d.style['margin-left']='3px'; d.style['font-size']='12px'; return [d.getAttribute('style'), d.style.cssText];`,
	vendor_cap: `const d=mk(); d.style.width='10px'; d.style.WebkitTransform='translateX(2px)'; return [d.getAttribute('style')];`,
	assign_dashed: `const d=mk(); Object.assign(d.style, {width:'10px', 'font-weight':'700'}); return [d.getAttribute('style')];`,
	proto_setprop_call: `const d=mk(); d.style.width='10px'; try { CSSStyleDeclaration.prototype.setProperty.call(d.style,'color','red'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [d.getAttribute('style'), d.style.color];`,
	proto_cssText_set: `const d=mk(); d.style.width='10px'; try { Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'cssText').set.call(d.style,'color: red'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [d.getAttribute('style')];`,
	reflect_set: `const d=mk(); d.style.width='10px'; Reflect.set(d.style, 'height', '9px'); return [d.getAttribute('style')];`,
	reflect_set_receiver: `const d=mk(); d.style.width='10px'; const o={}; try { Reflect.set(d.style, 'height', '9px', o); } catch(e){ return 'THROW '+e.name } return [d.getAttribute('style'), JSON.stringify(Object.keys(o))];`,
	object_create_style: `const d=mk(); d.style.width='10px'; const o=Object.create(d.style); try { o.height='8px'; } catch(e){ return 'THROW '+e.name } return [d.getAttribute('style'), d.style.height];`,
	// natively-driven style edits
	execcommand: `const h=mk(); h.style.cssText=''; h.contentEditable='true'; h.innerHTML='<span>hello</span>'; const sp=h.firstChild; sp.style.color='red'; h.focus(); const r=document.createRange(); r.selectNodeContents(sp); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, '#0000ff'); return [h.innerHTML, sp.getAttribute('style'), sp.style.color];`,
	execcommand_markup: `const h=mk(); h.style.cssText=''; h.contentEditable='true'; h.innerHTML='<span style="color: red;">hello</span>'; const sp=h.firstChild; h.focus(); const r=document.createRange(); r.selectNodeContents(sp); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, '#0000ff'); return [h.innerHTML];`,
	execcommand_justify: `const h=mk(); h.style.cssText=''; h.contentEditable='true'; h.innerHTML='<p>hello</p>'; const p=h.firstChild; p.style.marginTop='1px'; h.focus(); const r=document.createRange(); r.selectNodeContents(p); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('justifyCenter'); return [h.innerHTML];`,
	execcommand_bold_css: `const h=mk(); h.style.cssText=''; h.contentEditable='true'; h.innerHTML='<span>hi</span>'; const sp=h.firstChild; sp.style.fontSize='14px'; h.focus(); const r=document.createRange(); r.selectNodeContents(sp); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('styleWithCSS', false, true); document.execCommand('bold'); return [h.innerHTML];`,
	// other-realm style declaration, same element
	iframe_realm_style: `const f=document.createElement('iframe'); f.src='/sub.html?r=none'; document.body.appendChild(f); await new Promise(r=>f.onload=r); const d=f.contentDocument.createElement('div'); f.contentDocument.body.appendChild(d); d.style.width='10px'; const own=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'style').get.call(d); own.height='5px'; return [d.getAttribute('style')];`,
	adopted_node_style: `const f=document.createElement('iframe'); f.src='/sub.html?r=none'; document.body.appendChild(f); await new Promise(r=>f.onload=r); const d=f.contentDocument.createElement('div'); d.style.width='10px'; document.body.appendChild(d); d.style.height='5px'; return [d.getAttribute('style')];`,
	// selector engines over style
	qs_style_contains: `const d=mk(); d.className='qsx'; d.style.display='none'; d.style.display='block'; return [document.querySelectorAll('.qsx[style*="display: none"]').length, document.querySelectorAll('.qsx[style*="display: block"]').length];`,
	jquery_attr_restore: `const d=mk(); d.style.width='10px'; const saved=d.getAttribute('style'); d.style.cssFloat='left'; const saved2=d.getAttribute('style'); d.setAttribute('style', saved2); return [d.style.cssFloat];`,
	// typed OM write after a mirror
	typed_after_mirror: `const d=mk(); d.style.width='10px'; d.attributeStyleMap.set('height', CSS.px(3)); return [d.getAttribute('style')];`,
	typed_map_from_proto: `const d=mk(); d.style.width='10px'; const m=Object.getOwnPropertyDescriptor(Element.prototype,'attributeStyleMap') ? 'el' : 'html'; d.attributeStyleMap.set('height', CSS.px(3)); return [m, d.getAttribute('style')];`,
	// cloneNode keeps mirror in sync?
	clone_then_write: `const d=mk(); d.style.width='10px'; const c=d.cloneNode(); document.body.appendChild(c); c.style.cssFloat='left'; return [c.getAttribute('style')];`,
	removeAttribute_then_prop: `const d=mk(); d.style.width='10px'; d.removeAttribute('style'); d.style.cssFloat='left'; return [d.getAttribute('style'), d.hasAttribute('style')];`,
	toggle_attr: `const d=mk(); d.style.width='10px'; d.style.cssFloat='left'; d.toggleAttribute('style'); return [d.hasAttribute('style'), d.getAttribute('style')];`,
	attributes_value: `const d=mk(); d.style.width='10px'; d.style.cssFloat='left'; return [d.attributes.style && d.attributes.style.value, d.getAttributeNode('style').value];`,
	innerhtml_parent: `const h=mk(); h.innerHTML='<i style="color:red">x</i>'; h.firstChild.style.cssFloat='left'; return [h.innerHTML];`,
	textarea_like_native: `const t=document.createElement('textarea'); document.body.appendChild(t); t.style.width='50px'; return [t.getAttribute('style')];`,
};

export default [probeTest("rv18-mirror", probes)];

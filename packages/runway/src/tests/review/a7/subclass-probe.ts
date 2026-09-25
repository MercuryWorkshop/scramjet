import { basicTest } from "../../../testcommon.ts";

const P: Record<string, string> = {
	// ---- custom elements ----
	ce_basic: `class E1 extends HTMLElement { constructor(){ super(); this.x=1; } connectedCallback(){ this.innerHTML='<img src="/ce1.png">'; } } customElements.define('rv-e1', E1); const e=document.createElement('rv-e1'); document.body.appendChild(e); return [e instanceof E1, e.x, e.querySelector('img').getAttribute('src'), e.querySelector('img').src.includes('/~/')];`,
	ce_new: `class E2 extends HTMLElement {} customElements.define('rv-e2', E2); const e=new E2(); return [e instanceof E2, e.localName, Object.getPrototypeOf(e)===E2.prototype];`,
	ce_setattr_override: `const log=[]; class E3 extends HTMLElement { static get observedAttributes(){ return ['src','href','data-x']; } setAttribute(n,v){ log.push('set:'+n); return super.setAttribute(n,v); } getAttribute(n){ const v=super.getAttribute(n); log.push('get:'+n); return v; } attributeChangedCallback(n,o,v){ log.push('acc:'+n+'='+v); } } customElements.define('rv-e3', E3); const e=document.createElement('rv-e3'); e.setAttribute('src','/a.png'); e.setAttribute('data-x','1'); const g=e.getAttribute('src'); return [g, log];`,
	ce_observed_markup: `const log=[]; class E4 extends HTMLElement { static observedAttributes=['href','style']; attributeChangedCallback(n,o,v){ log.push(n+'='+v); } } customElements.define('rv-e4', E4); const d=document.createElement('div'); d.innerHTML='<rv-e4 href="/h" style="color:red"></rv-e4>'; document.body.appendChild(d); return log;`,
	ce_innerHTML_accessor: `class E5 extends HTMLElement { set innerHTML(v){ super.innerHTML = '<b>'+v+'</b>'; } get innerHTML(){ return 'X'+super.innerHTML; } } customElements.define('rv-e5', E5); const e=document.createElement('rv-e5'); e.innerHTML='<img src="/i5.png">'; return [e.innerHTML, e.querySelector('img') && e.querySelector('img').getAttribute('src')];`,
	ce_reflect_construct: `function E6(){ return Reflect.construct(HTMLElement, [], new.target); } E6.prototype = Object.create(HTMLElement.prototype); E6.prototype.constructor=E6; Object.setPrototypeOf(E6, HTMLElement); customElements.define('rv-e6', E6); const e=document.createElement('rv-e6'); const e2=new E6(); return [e instanceof E6, e2 instanceof E6, e2.localName];`,
	ce_setproto_polyfill: `function E7(){ const el = document.createElement('div'); Object.setPrototypeOf(el, E7.prototype); return el; } E7.prototype = Object.create(HTMLDivElement.prototype); const e=new E7(); e.setAttribute('href','/p'); e.innerHTML='<a href="/q">q</a>'; return [e instanceof HTMLElement, e.getAttribute('href'), e.querySelector('a').getAttribute('href'), e.querySelector('a').href];`,
	ce_builtin_anchor: `class A1 extends HTMLAnchorElement { constructor(){ super(); } } customElements.define('rv-a1', A1, {extends:'a'}); const a=document.createElement('a',{is:'rv-a1'}); a.href='/cba'; document.body.appendChild(a); return [a instanceof A1, a.href, a.getAttribute('href'), a.pathname];`,
	ce_builtin_img_markup: `class I1 extends HTMLImageElement {} customElements.define('rv-i1', I1, {extends:'img'}); const d=document.createElement('div'); d.innerHTML='<img is="rv-i1" src="/cbi.png">'; document.body.appendChild(d); const i=d.firstChild; return [i instanceof I1, i.getAttribute('src'), i.src];`,
	ce_shadow_style: `class E8 extends HTMLElement { constructor(){ super(); const s=this.attachShadow({mode:'open'}); s.innerHTML='<style>:host{background:url(/sh.png)}</style><img src="/shi.png">'; } } customElements.define('rv-e8', E8); const e=document.createElement('rv-e8'); document.body.appendChild(e); return [e.shadowRoot.querySelector('img').getAttribute('src'), e.shadowRoot.querySelector('img').src, e.shadowRoot.querySelector('style').sheet.cssRules[0].cssText];`,
	ce_adopted_shadow: `class E9 extends HTMLElement { constructor(){ super(); const s=this.attachShadow({mode:'open'}); const sh=new CSSStyleSheet(); sh.replaceSync(':host{background:url(/as.png)}'); s.adoptedStyleSheets=[sh]; } } customElements.define('rv-e9', E9); const e=document.createElement('rv-e9'); document.body.appendChild(e); return e.shadowRoot.adoptedStyleSheets[0].cssRules[0].cssText;`,
	ce_lit_like: `class Base extends HTMLElement { static observedAttributes=['label']; attributeChangedCallback(n,o,v){ this[n]=v; } connectedCallback(){ this.render(); } render(){ this.textContent=this.label; } } class L1 extends Base {} customElements.define('rv-l1', L1); const e=document.createElement('rv-l1'); e.setAttribute('label','hi'); document.body.appendChild(e); return e.textContent;`,
	ce_attachInternals: `class F1 extends HTMLElement { static formAssociated=true; constructor(){ super(); this.i=this.attachInternals(); } } customElements.define('rv-f1', F1); const e=new F1(); return typeof e.i.setFormValue;`,
	// ---- other subclasses ----
	sub_eventtarget: `class ET extends EventTarget { fire(){ this.dispatchEvent(new Event('x')); } } const t=new ET(); let n=0; t.addEventListener('x',()=>n++); t.fire(); return [n, t instanceof EventTarget];`,
	sub_event: `class MyEv extends Event { constructor(t, d){ super(t); this.d=d; } } const t=new EventTarget(); let got; t.addEventListener('y', e=>got=[e instanceof MyEv, e.d, e.type]); t.dispatchEvent(new MyEv('y', 5)); return got;`,
	sub_customevent: `class CE extends CustomEvent {} const e=new CE('z',{detail:{a:1}}); return [e instanceof CE, e.detail.a];`,
	sub_request: `class R extends Request { get foo(){ return 1; } } const r=new R('/rq', {method:'POST', body:'x'}); return [r instanceof R, r.foo, r.url, r.method];`,
	sub_request_fetch: `class R extends Request {} const r=new R('/script.js'); const res=await fetch(r); return [res.status, res.url];`,
	sub_response: `class Rs extends Response { get foo(){ return 2; } } const r=new Rs('hi', {status:201}); return [r instanceof Rs, r.foo, r.status, await r.text()];`,
	sub_headers: `class H extends Headers { set(k,v){ return super.set(k, v+'!'); } } const h=new H({a:'1'}); h.set('b','2'); return [h instanceof H, h.get('a'), h.get('b')];`,
	sub_url: `class U extends URL { get foo(){ return this.pathname; } } const u=new U('/su?x=1', location.href); return [u instanceof U, u.foo, u.href];`,
	sub_usp: `class S extends URLSearchParams {} const s=new S('a=1&b=2'); return [s instanceof S, s.get('b'), String(s)];`,
	sub_blob: `class B extends Blob {} const b=new B(['abc']); const u=URL.createObjectURL(b); return [b instanceof B, b.size, await b.text(), await (await fetch(u)).text()];`,
	sub_file: `class F extends File {} const f=new F(['a'],'n.txt'); return [f instanceof F, f.name];`,
	sub_ws: `class W extends WebSocket {} try { const w=new W('ws://localhost:1/x'); const r=[w instanceof W, w.url]; w.close(); return r; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	sub_xhr: `class X extends XMLHttpRequest { open(m,u,...r){ this.u=u; return super.open(m,u,...r); } } const x=new X(); x.open('GET','/script.js'); await new Promise(r=>{x.onload=x.onerror=r; x.send();}); return [x instanceof X, x.status, x.responseURL, x.u];`,
	sub_worker: `class Wk extends Worker {} const w=new Wk(URL.createObjectURL(new Blob(['postMessage(location.href)']))); const d=await new Promise(r=>{w.onmessage=e=>r(e.data); setTimeout(()=>r('TO'),2000)}); w.terminate(); return [w instanceof Wk, d.startsWith('blob:')];`,
	sub_mo: `class M extends MutationObserver { constructor(cb){ super(cb); this.k=1; } } let n=0; const m=new M(()=>n++); const d=document.createElement('div'); m.observe(d,{attributes:true}); d.id='q'; await new Promise(r=>setTimeout(r,10)); return [m instanceof M, m.k, n];`,
	sub_io: `class I extends IntersectionObserver {} const o=new I(()=>{}); o.observe(document.body); o.disconnect(); return o instanceof I;`,
	sub_cssss: `class C extends CSSStyleSheet { replaceSync(t){ this.t=t; return super.replaceSync(t); } } const c=new C(); c.replaceSync('.a{background:url(/cs.png)}'); return [c instanceof C, c.cssRules[0].cssText, c.t];`,
	sub_map: `class Mp extends Map { set(k,v){ return super.set(k, v*2); } } const m=new Mp([[1,1]]); m.set(2,2); return [...m];`,
	sub_promise: `class Pr extends Promise {} const p=Pr.resolve(1).then(x=>x+1); return [p instanceof Pr, await p];`,
	sub_audio: `class Au extends Audio {} const a=new Au('/au.mp3'); return [a instanceof Au, a.src];`,
	sub_image: `class Im extends Image {} const i=new Im(); i.src='/im.png'; return [i instanceof Im, i.src, i.getAttribute('src')];`,
	sub_option: `class Op extends Option {} const o=new Op('t','v'); return [o instanceof Op, o.value];`,
	sub_fontface: `class Ff extends FontFace {} const f=new Ff('x','url(/ff.woff)'); return f instanceof Ff;`,
	sub_bc: `class Bc extends BroadcastChannel {} const b=new Bc('x'); b.close(); return b instanceof Bc;`,
	sub_es: `class Es extends EventSource {} const e=new Es('/es'); const r=[e instanceof Es, e.url]; e.close(); return r;`,
	sub_abort: `class Ac extends AbortController {} const a=new Ac(); a.abort(); return [a instanceof Ac, a.signal.aborted];`,
	sub_domparser: `class Dp extends DOMParser {} const d=new Dp().parseFromString('<img src="/dp.png">','text/html'); return d.querySelector('img').getAttribute('src');`,
	reflect_construct_request: `class Z {} const r=Reflect.construct(Request, ['/rc'], Z); return [Object.getPrototypeOf(r)===Z.prototype, (()=>{ try { return Request.prototype.url.call; } catch(e){ return 'x'; } })() === undefined];`,
	// ---- captured natives ----
	react_value_setter: `const i=document.createElement('input'); document.body.appendChild(i); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'hello'); let fired=0; i.addEventListener('input',()=>fired++); i.dispatchEvent(new Event('input',{bubbles:true})); return [i.value, fired];`,
	react_checked_setter: `const i=document.createElement('input'); i.type='checkbox'; const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked').set; set.call(i,true); return i.checked;`,
	textarea_value_setter: `const t=document.createElement('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'v'); return t.value;`,
	img_src_desc: `const i=document.createElement('img'); const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src'); d.set.call(i,'/cap.png'); return [d.get.call(i), i.getAttribute('src'), i.src];`,
	a_href_desc: `const a=document.createElement('a'); Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype,'href').set.call(a,'/cap-a'); return [a.href, Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype,'href').get.call(a)];`,
	innerHTML_desc: `const d=document.createElement('div'); const desc=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML'); desc.set.call(d,'<img src="/ih.png">'); return [desc.get.call(d), d.firstChild.getAttribute('src'), d.firstChild.src.includes('/~/')||d.firstChild.src];`,
	innerHTML_proto_throw: `try { return HTMLElement.prototype.innerHTML; } catch(e){ return e.name+': '+e.message; }`,
	src_proto_throw: `try { return HTMLImageElement.prototype.src; } catch(e){ return e.name+': '+e.message; }`,
	style_proto_throw: `try { return HTMLElement.prototype.style; } catch(e){ return e.name+': '+e.message; }`,
	location_proto: `try { return Document.prototype.URL; } catch(e){ return e.name+': '+e.message; }`,
	cookie_proto: `try { return Document.prototype.cookie; } catch(e){ return e.name+': '+e.message; }`,
	appendChild_call: `const d=document.createElement('div'); const s=document.createElement('script'); s.textContent='window.__ac=location.host'; Node.prototype.appendChild.call(d, document.createElement('p')); Node.prototype.appendChild.call(document.body, s); return [d.childNodes.length, window.__ac===location.host];`,
	insertBefore_call: `const d=document.createElement('div'); const a=document.createElement('a'); Node.prototype.insertBefore.call(d,a,null); return d.firstChild===a;`,
	ael_call_window: `let n=0; EventTarget.prototype.addEventListener.call(window,'rv7ev',()=>n++); window.dispatchEvent(new Event('rv7ev')); EventTarget.prototype.removeEventListener.call(window,'rv7ev',()=>{}); return n;`,
	ael_call_document: `let n=0; const f=()=>n++; EventTarget.prototype.addEventListener.call(document,'rv7d',f); document.dispatchEvent(new Event('rv7d')); EventTarget.prototype.removeEventListener.call(document,'rv7d',f); document.dispatchEvent(new Event('rv7d')); return n;`,
	call_bind_slice: `const call=Function.prototype.call.bind(Array.prototype.slice); const gA=Function.prototype.call.bind(Element.prototype.getAttribute); const a=document.createElement('a'); a.href='/cb'; return [call([1,2,3],1), gA(a,'href')];`,
	call_bind_setattr: `const sA=Function.prototype.call.bind(Element.prototype.setAttribute); const i=document.createElement('img'); sA(i,'src','/cbs.png'); return [i.getAttribute('src'), i.src];`,
	reflect_apply_fetch: `const r=await Reflect.apply(fetch, window, ['/script.js']); return [r.status, r.url];`,
	reflect_apply_fetch_undef: `const r=await Reflect.apply(fetch, undefined, ['/script.js']); return r.status;`,
	fetch_call_null: `const r=await fetch.call(null, '/script.js'); return r.status;`,
	destructure_pushstate: `const {pushState}=history; pushState.call(history, null, '', '/dps'); return location.pathname;`,
	pushstate_apply: `History.prototype.replaceState.apply(history, [null,'','/dpa']); return location.pathname;`,
	getattr_captured_early: `const ga=Element.prototype.getAttribute; const i=document.createElement('img'); i.src='/g.png'; return ga.call(i,'src');`,
	setattr_ns: `const i=document.createElementNS('http://www.w3.org/1999/xhtml','img'); Element.prototype.setAttributeNS.call(i,null,'src','/ns.png'); return [i.getAttribute('src'), i.src];`,
	attr_node: `const i=document.createElement('img'); const a=document.createAttribute('src'); a.value='/an.png'; i.setAttributeNode(a); return [i.getAttribute('src'), i.src, a.value];`,
	desc_value_proto_call_wrong: `try { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.createElement('div'),'x'); return 'nothrow'; } catch(e){ return e.name; }`,
	settimeout_captured: `const st=window.setTimeout; return await new Promise(r=>st.call(window, ()=>r('ok'), 0));`,
	xhr_open_captured: `const open=XMLHttpRequest.prototype.open; const x=new XMLHttpRequest(); open.call(x,'GET','/script.js'); await new Promise(r=>{x.onload=x.onerror=r; x.send();}); return [x.status, x.responseURL];`,
	// ---- page prototype patching ----
	patch_setattr: `const orig=Element.prototype.setAttribute; let calls=0; Element.prototype.setAttribute=function(n,v){ calls++; return orig.call(this,n,v); }; const i=document.createElement('img'); i.setAttribute('src','/ps.png'); const r=[calls, i.getAttribute('src'), i.src, i.outerHTML]; Element.prototype.setAttribute=orig; return r;`,
	patch_setattr_prop_path: `const orig=Element.prototype.setAttribute; let calls=0; Element.prototype.setAttribute=function(n,v){ calls++; return orig.call(this,n,v); }; const i=document.createElement('img'); i.src='/pp.png'; const a=document.createElement('a'); a.href='/ph'; const d=document.createElement('div'); d.innerHTML='<img src="/pi.png">'; Element.prototype.setAttribute=orig; return [calls, i.getAttribute('src'), a.getAttribute('href')];`,
	patch_insertBefore_translate: `const orig=Node.prototype.insertBefore; Node.prototype.insertBefore=function(n,r){ if(r && r.parentNode!==this) return n; return orig.apply(this, arguments); }; const origR=Node.prototype.removeChild; Node.prototype.removeChild=function(c){ if(c.parentNode!==this) return c; return origR.apply(this, arguments); }; const d=document.createElement('div'); const a=document.createElement('p'); d.appendChild(a); d.insertBefore(document.createElement('b'), a); d.removeChild(a); const s=document.createElement('script'); s.textContent='window.__pib=1'; document.body.insertBefore(s, null); Node.prototype.insertBefore=orig; Node.prototype.removeChild=origR; return [d.innerHTML, window.__pib];`,
	patch_xhr: `const o=XMLHttpRequest.prototype.open, s=XMLHttpRequest.prototype.send; const seen=[]; XMLHttpRequest.prototype.open=function(m,u){ seen.push(String(u)); return o.apply(this, arguments); }; XMLHttpRequest.prototype.send=function(){ seen.push('send'); return s.apply(this, arguments); }; const x=new XMLHttpRequest(); x.open('GET','/script.js'); await new Promise(r=>{x.onload=x.onerror=r; x.send();}); XMLHttpRequest.prototype.open=o; XMLHttpRequest.prototype.send=s; return [seen, x.status, x.responseURL];`,
	patch_fetch: `const of=window.fetch; const seen=[]; window.fetch=function(i, init){ seen.push(String(i)); return of.apply(this, arguments); }; const r=await fetch('/script.js'); window.fetch=of; return [seen, r.status, r.url, window.fetch===of];`,
	patch_fetch_bind: `const of=window.fetch; window.fetch=of.bind(window); const r=await fetch('/script.js'); window.fetch=of; return r.status;`,
	patch_pushstate: `const op=history.pushState; const seen=[]; history.pushState=function(s,t,u){ seen.push(u); return op.apply(this, arguments); }; history.pushState(null,'','/wp'); delete history.pushState; return [seen, location.pathname, history.pushState===op, Object.hasOwn(history,'pushState')];`,
	patch_pushstate_proto: `const op=History.prototype.pushState; History.prototype.pushState=function(...a){ return op.apply(this,a); }; history.pushState(null,'','/wpp'); History.prototype.pushState=op; return location.pathname;`,
	patch_ael_zone: `const oa=EventTarget.prototype.addEventListener, orr=EventTarget.prototype.removeEventListener; let n=0; EventTarget.prototype.addEventListener=function(t,f,o){ n++; return oa.call(this,t,f,o); }; EventTarget.prototype.removeEventListener=function(t,f,o){ return orr.call(this,t,f,o); }; let hits=0; const f=()=>hits++; window.addEventListener('rvz',f); document.addEventListener('rvz',f); window.dispatchEvent(new Event('rvz')); window.removeEventListener('rvz',f); window.dispatchEvent(new Event('rvz')); EventTarget.prototype.addEventListener=oa; EventTarget.prototype.removeEventListener=orr; return [n>=2, hits];`,
	patch_ael_onmessage: `const oa=EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener=function(t,f,o){ return oa.call(this,t,f,o); }; const got=await new Promise(r=>{ window.addEventListener('message', e=>r([e.data, e.origin]), {once:true}); postMessage('pm','*'); }); EventTarget.prototype.addEventListener=oa; return [got[0], got[1]===location.origin];`,
	delete_restore_member: `const d=Object.getOwnPropertyDescriptor(Element.prototype,'setAttribute'); delete Element.prototype.setAttribute; const gone = !('setAttribute' in document.body); Object.defineProperty(Element.prototype,'setAttribute',d); const i=document.createElement('img'); i.setAttribute('src','/dr.png'); return [gone, i.getAttribute('src'), i.src];`,
	instance_define_src: `const i=document.createElement('img'); let stored=null; Object.defineProperty(i,'src',{get(){ return stored; }, set(v){ stored=v; }, configurable:true}); i.src='/lazy.png'; const r=[i.getAttribute('src'), stored]; delete i.src; i.src=stored; return r.concat([i.getAttribute('src'), i.src]);`,
	instance_define_src_proto_set: `const i=document.createElement('img'); const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src'); Object.defineProperty(i,'src',{set(v){ desc.set.call(this, v); }, get(){ return desc.get.call(this); }}); i.src='/lz2.png'; return [i.src, i.getAttribute('src')];`,
	freeze_proto: `'use strict'; const f=document.createElement('iframe'); document.body.appendChild(f); const w=f.contentWindow; try { w.Object.freeze(w.Element.prototype); w.Object.freeze(w.Node.prototype); w.Object.freeze(w.EventTarget.prototype); const i=w.document.createElement('img'); i.src='/fr.png'; w.document.body.appendChild(i); return [i.getAttribute('src'), i.src.includes('fr.png')]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	freeze_proto_main: `Object.freeze(HTMLImageElement.prototype); const i=document.createElement('img'); i.src='/fz.png'; return [i.getAttribute('src'), i.src];`,
	// ---- shape ----
	forin_el: `const d=document.createElement('div'); let n=0; for (const k in d) n++; return n;`,
	keys_htmlelement: `return Object.keys(HTMLElement.prototype).length;`,
	names_htmlelement: `return Object.getOwnPropertyNames(HTMLElement.prototype).sort().join(',').length;`,
	names_element: `return Object.getOwnPropertyNames(Element.prototype).length;`,
	names_document: `return Object.getOwnPropertyNames(Document.prototype).length;`,
	desc_shape_document: `const ds=Object.getOwnPropertyDescriptors(Document.prototype); return ['URL','cookie','domain','referrer','write','open','querySelector','documentURI','title'].map(k=>{ const d=ds[k]; return k+':'+(d? [typeof d.get, typeof d.set, typeof d.value, d.enumerable, d.configurable, d.writable].join('/') : 'none'); });`,
	desc_shape_element: `const ds=Object.getOwnPropertyDescriptors(Element.prototype); return ['setAttribute','getAttribute','innerHTML','outerHTML','attributes','insertAdjacentHTML','id'].map(k=>{ const d=ds[k]; return k+':'+(d? [typeof d.get, typeof d.set, typeof d.value, d.enumerable, d.configurable, d.writable].join('/') : 'none'); });`,
	desc_shape_img: `const ds=Object.getOwnPropertyDescriptors(HTMLImageElement.prototype); return ['src','srcset','currentSrc','decode'].map(k=>{ const d=ds[k]; return k+':'+(d? [typeof d.get, typeof d.set, typeof d.value, d.enumerable, d.configurable].join('/') : 'none'); });`,
	window_names: `return Object.getOwnPropertyNames(window).length;`,
	window_names_scram: `return Object.getOwnPropertyNames(window).filter(n=>/scramjet|\\$sj|^__/.test(n));`,
	window_new_names: `const f=document.createElement('iframe'); document.body.appendChild(f); const a=new Set(Object.getOwnPropertyNames(f.contentWindow)); return Object.getOwnPropertyNames(window).filter(n=>!a.has(n) && !n.startsWith('__') && !['assert','assertEqual','assertDeepEqual','ok','pass','fail','runTest','assertConsistent','checkglobal'].includes(n)).slice(0,30);`,
	in_checks: `const i=document.createElement('img'); return ['src' in i, i.hasOwnProperty('src'), 'onload' in i, 'style' in i, Object.hasOwn(i,'style'), 'setAttribute' in i];`,
	fn_meta: `const fs={setAttribute:Element.prototype.setAttribute, getAttribute:Element.prototype.getAttribute, appendChild:Node.prototype.appendChild, fetch, setTimeout, pushState:History.prototype.pushState, addEventListener:EventTarget.prototype.addEventListener, querySelector:Document.prototype.querySelector, open:window.open, write:Document.prototype.write, insertRule:CSSStyleSheet.prototype.insertRule, createObjectURL:URL.createObjectURL, postMessage:window.postMessage, sendBeacon:Navigator.prototype.sendBeacon, getEntriesByType:Performance.prototype.getEntriesByType}; return Object.entries(fs).map(([k,f])=>k+':'+f.name+'/'+f.length+'/'+Function.prototype.toString.call(f).replace(/\\s+/g,' '));`,
	getter_meta: `const g=[[Document.prototype,'URL'],[Document.prototype,'cookie'],[HTMLImageElement.prototype,'src'],[Element.prototype,'innerHTML'],[HTMLElement.prototype,'style'],[Node.prototype,'textContent'],[PerformanceEntry.prototype,'name'],[Window.prototype,'frameElement']]; return g.map(([p,k])=>{ const d=Object.getOwnPropertyDescriptor(p,k) || Object.getOwnPropertyDescriptor(window,k); if(!d) return k+':none'; return k+':'+(d.get&&d.get.name)+'/'+(d.get&&d.get.length)+'/'+(d.set?d.set.name+'/'+d.set.length:'-')+'/'+Function.prototype.toString.call(d.get).replace(/\\s+/g,' '); });`,
	ctor_meta: `return [Request, Response, Headers, URL, Blob, WebSocket, XMLHttpRequest, Worker, Audio, Image, FontFace, EventSource, MutationObserver].map(c=>c.name+'/'+c.length+'/'+Function.prototype.toString.call(c).replace(/\\s+/g,' ')+'/'+(c.prototype.constructor===c));`,
	fn_prototype_prop: `return [Element.prototype.setAttribute.hasOwnProperty('prototype'), 'prototype' in fetch, (()=>{ try { new Element.prototype.setAttribute(); return 'constructed'; } catch(e){ return e.name; } })(), (()=>{ try { new fetch('/'); return 'constructed'; } catch(e){ return e.name; } })()];`,
	fn_identity: `const f=document.createElement('iframe'); document.body.appendChild(f); return [Element.prototype.setAttribute===Element.prototype.setAttribute, document.body.setAttribute===Element.prototype.setAttribute, f.contentWindow.Element.prototype.setAttribute===Element.prototype.setAttribute, Object.getPrototypeOf(Element.prototype.setAttribute)===Function.prototype];`,
	toString_tostring: `return [Function.prototype.toString.call(Function.prototype.toString), String(Element.prototype.setAttribute), Element.prototype.setAttribute.toString()];`,
	proxy_detect: `let msg; try { Element.prototype.setAttribute.call(1); } catch(e){ msg=e.message; } let m2; try { Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML').get.call({}); } catch(e){ m2=e.message; } return [msg, m2];`,
	stack_leak: `let st; try { Element.prototype.setAttribute.call({}, 'a', 'b'); } catch(e){ st=e.stack; } return st.split('\\n').length+':'+(/scramjet|\\/~\\/|client/.test(st));`,
};

export default [
	basicTest({
		name: "rv7-subclass-probe",
		autoPass: false,
		js: `
		const probes = {${Object.entries(P)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {};
		for (const [k, v] of Object.entries(probes)) {
			try {
				const res = await Promise.race([v(), new Promise(r=>setTimeout(()=>r('TIMEOUT'), 3000))]);
				out[k] = JSON.stringify(res);
			} catch (e) {
				out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message);
			}
		}
		console.log('RV7PROBE ' + JSON.stringify(out));
		fail('RV7PROBE ' + JSON.stringify(out));
		`,
	}),
];

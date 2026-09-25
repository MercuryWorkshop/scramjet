import { basicTest } from "../../../testcommon.ts";

const P: Record<string, string> = {
	window_all_names: `return Object.getOwnPropertyNames(window).filter(n=>!/^(__|\\$scramjet|assert|ok$|pass$|fail$|runTest|checkglobal)/.test(n)).sort().join(',');`,
	ws_subclass_method: `class W extends WebSocket { hello(){ return 'hi'; } } try { const w=new W('ws://localhost:1/x'); const r=[typeof w.hello, w instanceof W, w.constructor===W]; w.close(); return r; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	wss_subclass: `if (!self.WebSocketStream) return 'n/a'; class W extends WebSocketStream {} try { const w=new W('ws://localhost:1/x'); w.opened.catch(()=>{}); w.closed.catch(()=>{}); return w instanceof W; } catch(e){ return 'THROW '+e.name; }`,
	reflect_construct_ws: `function F(){} F.prototype=Object.create(WebSocket.prototype); const w=Reflect.construct(WebSocket, ['ws://localhost:1/y'], F); const r=Object.getPrototypeOf(w)===F.prototype; w.close(); return r;`,
	sub_request_proto_methods: `class R extends Request { clone(){ return 'mine'; } } const r=new R('/x'); return [r.clone(), r instanceof R];`,
	sub_xhr_reflect: `function F(){} F.prototype=Object.create(XMLHttpRequest.prototype); const x=Reflect.construct(XMLHttpRequest, [], F); return Object.getPrototypeOf(x)===F.prototype;`,
	sub_worker_reflect: `function F(){} F.prototype=Object.create(Worker.prototype); const w=Reflect.construct(Worker, [URL.createObjectURL(new Blob(['']))], F); const r=Object.getPrototypeOf(w)===F.prototype; w.terminate(); return r;`,
	sub_eventsource_reflect: `function F(){} F.prototype=Object.create(EventSource.prototype); const e=Reflect.construct(EventSource, ['/es'], F); const r=Object.getPrototypeOf(e)===F.prototype; e.close(); return r;`,
	sub_audio_reflect: `function F(){} F.prototype=Object.create(HTMLAudioElement.prototype); const a=Reflect.construct(Audio, ['/a.mp3'], F); return Object.getPrototypeOf(a)===F.prototype;`,
	sub_image_extend_method: `class Im extends Image { constructor(){ super(10, 20); this.k=1; } } const i=new Im(); return [i.width, i.height, i.k];`,
	sub_bc_reflect: `class B extends BroadcastChannel { m(){ return 1; } } const b=new B('q'); const r=[b.m(), b instanceof B]; b.close(); return r;`,
	sub_sharedworker: `if (!self.SharedWorker) return 'n/a'; class S extends SharedWorker {} const s=new S(URL.createObjectURL(new Blob(['']))); return s instanceof S;`,
	sub_fontface_method: `class F extends FontFace { m(){ return 3; } } return new F('a','url(/x)').m();`,
	sub_headers_iter: `class H extends Headers {} const h=new H([['a','1'],['b','2']]); return [...h].length;`,
	sub_url_static: `class U extends URL {} return [typeof U.canParse, U.canParse('/x', location.href), typeof U.createObjectURL];`,
	sub_url_createObjectURL: `class U extends URL {} const u=U.createObjectURL(new Blob(['x'])); return u.startsWith('blob:'+location.origin);`,
	sub_domparser_method: `class D extends DOMParser { m(){ return 2; } } return new D().m();`,
	textContent_desc_script: `const s=document.createElement('script'); Object.getOwnPropertyDescriptor(Node.prototype,'textContent').set.call(s, 'window.__tcd = location.host'); document.body.appendChild(s); return window.__tcd === location.host;`,
	script_src_desc: `const s=document.createElement('script'); Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src').set.call(s, '/sd.js'); return [s.getAttribute('src'), s.src];`,
	reflect_get_receiver: `const i=document.createElement('img'); i.src='/rg.png'; return [Reflect.get(HTMLImageElement.prototype, 'src', i), Reflect.get(Element.prototype,'outerHTML',i)];`,
	reflect_set: `const i=document.createElement('img'); Reflect.set(i,'src','/rs.png'); return [i.getAttribute('src'), i.src];`,
	apply_call_setattr: `const i=document.createElement('img'); Function.prototype.apply.call(Element.prototype.setAttribute, i, ['src','/ac.png']); return [i.getAttribute('src'), i.src];`,
	createElement_bound: `const ce=document.createElement.bind(document); const i=ce('img'); i.src='/cb.png'; return i.getAttribute('src');`,
	outerHTML_desc: `const d=document.createElement('div'); document.body.appendChild(d); Object.getOwnPropertyDescriptor(Element.prototype,'outerHTML').set.call(d,'<a id="od" href="/od">x</a>'); const a=document.getElementById('od'); return [a.getAttribute('href'), a.href];`,
	insertAdjacentHTML_call: `const d=document.createElement('div'); Element.prototype.insertAdjacentHTML.call(d,'beforeend','<img src="/iah.png">'); return [d.firstChild.getAttribute('src'), d.firstChild.src];`,
	patch_innerHTML_setter: `const desc=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML'); let n=0; Object.defineProperty(Element.prototype,'innerHTML',{...desc, set(v){ n++; return desc.set.call(this, v); }}); const d=document.createElement('div'); d.innerHTML='<img src="/pi.png">'; Object.defineProperty(Element.prototype,'innerHTML',desc); return [n, d.firstChild.getAttribute('src'), d.innerHTML];`,
	patch_getattr_double: `const og=Element.prototype.getAttribute; Element.prototype.getAttribute=function(n){ return og.call(this, n); }; const a=document.createElement('a'); a.href='/pg'; const r=[a.getAttribute('href'), a.href]; Element.prototype.getAttribute=og; return r;`,
	patch_setattr_then_prop: `const os=Element.prototype.setAttribute; Element.prototype.setAttribute=function(n,v){ return os.call(this, n, v); }; const i=document.createElement('img'); i.setAttribute('src','/x1.png'); i.src='/x2.png'; i.setAttribute('srcset','/x3.png 2x'); const r=[i.getAttribute('src'), i.src, i.getAttribute('srcset'), i.outerHTML]; Element.prototype.setAttribute=os; return r;`,
	patch_appendChild: `const oa=Node.prototype.appendChild; let n=0; Node.prototype.appendChild=function(c){ n++; return oa.call(this,c); }; const s=document.createElement('script'); s.textContent='window.__pa=location.host'; document.body.appendChild(s); const d=document.createElement('div'); d.innerHTML='<p>a</p><p>b</p>'; Node.prototype.appendChild=oa; return [n, window.__pa===location.host];`,
	patch_createElement: `const oc=Document.prototype.createElement; Document.prototype.createElement=function(t,o){ const e=oc.call(this,t,o); e.dataset.made='1'; return e; }; const d=document.createElement('div'); d.innerHTML='<span></span>'; const i=new Image(); Document.prototype.createElement=oc; return [d.dataset.made, d.firstChild.dataset.made, i.dataset.made];`,
	patch_window_open: `const oo=window.open; let seen; window.open=function(u){ seen=u; return null; }; window.open('/wo'); window.open=oo; return seen;`,
	patch_ael_wrap_listener: `const oa=EventTarget.prototype.addEventListener, orr=EventTarget.prototype.removeEventListener; const map=new WeakMap(); EventTarget.prototype.addEventListener=function(t,f,o){ const w=function(e){ return f.call(this,e); }; map.set(f,w); return oa.call(this,t,w,o); }; EventTarget.prototype.removeEventListener=function(t,f,o){ return orr.call(this,t,map.get(f)||f,o); }; let n=0; const f=()=>n++; document.body.addEventListener('click', f); document.body.click(); document.body.removeEventListener('click', f); document.body.click(); window.onfoo=null; EventTarget.prototype.addEventListener=oa; EventTarget.prototype.removeEventListener=orr; return n;`,
	patch_dispatchEvent: `const od=EventTarget.prototype.dispatchEvent; let n=0; EventTarget.prototype.dispatchEvent=function(e){ n++; return od.call(this,e); }; const got=await new Promise(r=>{ addEventListener('message', e=>r(e.origin), {once:true}); postMessage('x','*'); }); EventTarget.prototype.dispatchEvent=od; return [got===location.origin, n];`,
	patch_postMessage: `const op=window.postMessage; let seen; window.postMessage=function(m,o){ seen=[m,o]; return op.apply(this, arguments); }; const got=await new Promise(r=>{ addEventListener('message', e=>r([e.data, e.origin===location.origin]), {once:true}); window.postMessage('pp', location.origin); }); window.postMessage=op; return [seen, got];`,
	patch_postMessage_targetorigin_star_call: `const op=window.postMessage; const got=await new Promise(r=>{ addEventListener('message', e=>r(e.data), {once:true}); op.call(window, 'pc', '*'); }); return got;`,
	patch_history_replace_wrapper_this: `const or=history.replaceState; history.replaceState=function(){ return or.apply(history, arguments); }; history.replaceState(null,'','/hw'); delete history.replaceState; return location.pathname;`,
	patch_location_assign: `try { const oa=location.assign; location.assign=function(){}; return 'assigned '+(location.assign===oa); } catch(e){ return 'THROW '+e.name; }`,
	patch_settimeout: `const ost=window.setTimeout; let n=0; window.setTimeout=function(f,t,...a){ n++; return ost(f,t,...a); }; await new Promise(r=>setTimeout(r,0)); window.setTimeout=ost; return n;`,
	patch_fetch_response_json: `const of=window.fetch; window.fetch=async (...a)=>{ const r=await of(...a); return r; }; const r=await fetch('/script.js'); window.fetch=of; return [r.status, r.url];`,
	freeze_intrinsics: `const f=document.createElement('iframe'); document.body.appendChild(f); const w=f.contentWindow; const res={}; try { for (const k of ['Object','Array','Function','Promise','String','Number','Boolean','Symbol','Error','RegExp','Map','Set','WeakMap','Date','JSON','Math','Reflect']) { const v=w[k]; w.Object.freeze(v); if (v && v.prototype) w.Object.freeze(v.prototype); } w.Object.freeze(w.Object.getPrototypeOf(w.eval('(function*(){})'))); } catch(e){ return 'freezefail '+e; } const run=(code)=>{ try { return w.eval(code); } catch(e){ return 'THROW '+e.name+': '+e.message; } }; res.el=run('(()=>{ const i=document.createElement("img"); i.src="/fz.png"; document.body.appendChild(i); return i.getAttribute("src") + " " + i.src; })()'); res.fetch=await Promise.resolve(run('fetch("/script.js").then(r=>r.status, e=>"REJ "+e)')); res.ev=run('(()=>{ let n=0; addEventListener("zz",()=>n++); dispatchEvent(new Event("zz")); return n; })()'); res.hist=run('(()=>{ history.replaceState(null,""); return "ok"; })()'); res.st=await new Promise(r=>{ try { w.setTimeout(()=>r("ok"),0); } catch(e){ r("THROW "+e); } setTimeout(()=>r("TO"),1000); }); res.inner=run('(()=>{ const d=document.createElement("div"); d.innerHTML="<a href=\\"/fa\\">x</a>"; return d.firstChild.href; })()'); res.loc=run('location.href'); res.cookie=run('(document.cookie="fz=1", document.cookie)'); res.xhr=run('(()=>{ const x=new XMLHttpRequest(); x.open("GET","/script.js",false); x.send(); return x.status; })()'); res.pm=await new Promise(r=>{ try { w.addEventListener("message", e=>r(e.data), {once:true}); w.postMessage("fpm","*"); } catch(e){ r("THROW "+e); } setTimeout(()=>r("TO"),1000); }); res.style=run('(()=>{ const d=document.createElement("div"); d.style.backgroundImage="url(/fs.png)"; return d.style.backgroundImage; })()'); res.fn=run('new Function("return location.host")()'); return res;`,
	freeze_intrinsics_top_realm_sanity: `return 'n/a';`,
	custom_el_upgrade: `const d=document.createElement('div'); d.innerHTML='<rv-up href="/up"></rv-up>'; document.body.appendChild(d); const log=[]; class U extends HTMLElement { static observedAttributes=['href']; connectedCallback(){ log.push('conn'); } attributeChangedCallback(n,o,v){ log.push(n+'='+v); } } customElements.define('rv-up', U); return [log, d.firstChild instanceof U];`,
	custom_el_setattr_in_ctor_cb: `const log=[]; class C extends HTMLElement { static observedAttributes=['src']; connectedCallback(){ this.setAttribute('src','/cc.png'); } attributeChangedCallback(n,o,v){ log.push(n+':'+o+'->'+v); } } customElements.define('rv-cc', C); const c=document.createElement('rv-cc'); document.body.appendChild(c); c.setAttribute('src','/cc2.png'); c.removeAttribute('src'); return log;`,
	custom_el_getAttributeNames: `class G extends HTMLElement {} customElements.define('rv-gan', G); const g=document.createElement('rv-gan'); g.setAttribute('href','/g'); g.setAttribute('style','color:red'); g.setAttribute('onclick','void 0'); return [g.getAttributeNames(), g.attributes.length, g.outerHTML];`,
	custom_el_observed_onclick: `const log=[]; class O extends HTMLElement { static observedAttributes=['onclick','srcdoc','integrity']; attributeChangedCallback(n,o,v){ log.push(n+'='+v); } } customElements.define('rv-oc', O); const o=document.createElement('rv-oc'); o.setAttribute('onclick','x()'); o.setAttribute('srcdoc','<p>'); o.setAttribute('integrity','sha-1'); return log;`,
	custom_el_template_clone: `const t=document.createElement('template'); t.innerHTML='<img src="/tc.png"><a href="/ta">x</a>'; const c=t.content.cloneNode(true); const c2=document.importNode(t.content, true); return [c.firstChild.getAttribute('src'), c.firstChild.src, c2.querySelector('a').href];`,
};

export default [
	basicTest({
		name: "rv7-subclass2-probe",
		autoPass: false,
		js: `
		const probes = {${Object.entries(P)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'};
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

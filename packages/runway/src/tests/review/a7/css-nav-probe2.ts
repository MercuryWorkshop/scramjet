import { basicTest } from "../../../testcommon.ts";

const probes: Record<string, string> = {
	proto_setprop_call: `const d=document.createElement('div'); try { CSSStyleDeclaration.prototype.setProperty.call(d.style,'background-image','url(/pc.png)'); return d.getAttribute('style'); } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	proto_gpv_call: `const d=document.createElement('div'); d.style.color='red'; try { return CSSStyleDeclaration.prototype.getPropertyValue.call(d.style,'color'); } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	proto_cssText_get: `const d=document.createElement('div'); d.style.color='red'; try { return Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'cssText').get.call(d.style); } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	proto_item_call: `const d=document.createElement('div'); d.style.color='red'; try { return CSSStyleDeclaration.prototype.item.call(d.style,0); } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	style_length_proto: `const d=document.createElement('div'); d.style.color='red'; try { return Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'length').get.call(d.style); } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	weakmap_style_key: `const d=document.createElement('div'); const wm=new WeakMap(); wm.set(d.style,1); return wm.get(d.style);`,
	style_structuredClone: `try { structuredClone(document.body.style); return 'nothrow'; } catch(e){ return e.name; }`,
	snapshot_names: `const d=document.createElement('div'); const own=Object.getOwnPropertyNames(d.style); return ['background-image','backgroundImage','webkitTransform','WebkitTransform','-webkit-transform','cssFloat','float','fill','mask-image','maskImage','webkitMaskImage','listStyleImage','cursor','borderImage','content'].map(n=>n+':'+own.includes(n));`,
	dashed_read: `const d=document.createElement('div'); d.style.backgroundImage='url(/dr.png)'; return d.style['background-image'];`,
	dashed_write: `const d=document.createElement('div'); d.style['background-image']='url(/dw.png)'; return [d.style.backgroundImage, d.style.cssText, d.style.getPropertyValue('background-image')];`,
	dashed_write_raw: `const d=document.createElement('div'); document.body.appendChild(d); d.style['background-image']='url(/dw2.png)'; return getComputedStyle(d).backgroundImage;`,
	webkit_mask_write: `const d=document.createElement('div'); document.body.appendChild(d); d.style.webkitMaskImage='url(/mk.png)'; d.style.WebkitMaskImage='url(/mk2.png)'; return getComputedStyle(d).webkitMaskImage;`,
	webkit_mask_read: `const d=document.createElement('div'); d.style.setProperty('-webkit-mask-image','url(/mk3.png)'); return [d.style.webkitMaskImage, d.style.WebkitMaskImage, d.style['-webkit-mask-image']];`,
	cursor_write: `const d=document.createElement('div'); document.body.appendChild(d); d.style.cursor='url(/cur.png), auto'; return getComputedStyle(d).cursor;`,
	svg_fill_frag: `const d=document.createElementNS('http://www.w3.org/2000/svg','rect'); d.style.fill='url(#g)'; return [d.style.fill, getComputedStyle(document.body.appendChild(d)).fill];`,
	svg_fill_frag_setprop: `const d=document.createElementNS('http://www.w3.org/2000/svg','rect'); d.style.setProperty('fill','url(#g)'); return [d.style.fill, getComputedStyle(document.body.appendChild(d)).fill];`,
	html_filter_frag: `const d=document.createElement('div'); d.style.filter='url(#f)'; return [d.style.filter, getComputedStyle(document.body.appendChild(d)).filter];`,
	rule_fill_frag: `const s=document.createElement('style'); document.head.appendChild(s); s.sheet.insertRule('.x{}'); const r=s.sheet.cssRules[0]; r.style.fill='url(#g)'; return [r.cssText];`,
	mo_style_prop: `const d=document.createElement('div'); document.body.appendChild(d); const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributes:true}); d.style.color='red'; await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.attributeName);`,
	mo_style_setattr: `const d=document.createElement('div'); document.body.appendChild(d); const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributes:true}); d.setAttribute('style','color:red'); await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.attributeName);`,
	mo_img_src: `const d=document.createElement('img'); document.body.appendChild(d); const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributes:true}); d.src='/a.png'; await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.attributeName);`,
	mo_subtree_style: `const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(document.body,{attributes:true, subtree:true}); const d=document.createElement('div'); document.body.appendChild(d); d.style.width='3px'; d.style.height='3px'; await new Promise(r=>setTimeout(r,10)); mo.disconnect(); return recs.map(r=>r.attributeName);`,
	mo_takeRecords: `const d=document.createElement('div'); document.body.appendChild(d); const mo=new MutationObserver(()=>{}); mo.observe(d,{attributes:true}); d.style.color='red'; return mo.takeRecords().map(r=>r.attributeName);`,
	mo_record_getattr: `const d=document.createElement('div'); document.body.appendChild(d); const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributes:true}); d.style.color='red'; await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.target.getAttribute(r.attributeName));`,
	cssText_rule_set: `const s=document.createElement('style'); document.head.appendChild(s); s.sheet.insertRule('.x{}'); const r=s.sheet.cssRules[0]; try { r.cssText='.y{background:url(/zz.png)}'; } catch(e) { return 'THROW '+e; } return r.cssText;`,
	style_proxy_desc: `const d=document.createElement('div'); d.style.backgroundImage='url(/pd.png)'; const desc=Object.getOwnPropertyDescriptor(d.style,'backgroundImage'); return desc ? [desc.value, typeof desc.get] : 'none';`,
	style_define: `const d=document.createElement('div'); Object.defineProperty(d.style,'backgroundImage',{value:'url(/df.png)', configurable:true, writable:true, enumerable:true}); return [d.style.backgroundImage, d.getAttribute('style')];`,
	style_reflect_set_receiver: `const d=document.createElement('div'); const o=Object.create(d.style); try { o.color='red'; } catch(e){ return 'THROW '+e.name; } return [d.style.color];`,
	style_spread: `const d=document.createElement('div'); d.style.color='red'; try { const o={...d.style}; return Object.keys(o).length>0; } catch(e){ return 'THROW '+e; }`,
	style_Object_assign: `const d=document.createElement('div'); Object.assign(d.style,{backgroundImage:'url(/oa.png)', color:'red'}); return d.getAttribute('style');`,
	style_proto_chain: `const d=document.createElement('div'); return [Object.getPrototypeOf(d.style)===CSSStyleDeclaration.prototype || Object.getPrototypeOf(d.style).constructor.name];`,
	style_method_call_other: `const a=document.createElement('div'), b=document.createElement('div'); a.style.setProperty.call(b.style,'color','red'); return [a.style.color, b.style.color];`,
	style_method_apply_this: `const a=document.createElement('div'); const sp=a.style.setProperty; sp.call(a.style,'color','blue'); return a.style.color;`,
	style_gpv_other: `const a=document.createElement('div'), b=document.createElement('div'); b.style.color='green'; return a.style.getPropertyValue.call(b.style,'color');`,
	cssom_decl_proto_setter: `const d=document.createElement('div'); const desc=Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'cssText'); desc.set.call(d.style,'background:url(/pp.png)'); return d.getAttribute('style');`,
	sandbox_note: `return 'see separate test';`,
	about_blank_pushstate: `const f=document.createElement('iframe'); document.body.appendChild(f); try { f.contentWindow.history.pushState(null,'','#x'); return ['ok', f.contentWindow.location.href]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	about_blank_replace_self: `const f=document.createElement('iframe'); document.body.appendChild(f); try { f.contentWindow.history.replaceState(null,'',f.contentWindow.location.href); return ['ok', f.contentWindow.location.href]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	doc_write_iframe_pushstate: `const f=document.createElement('iframe'); document.body.appendChild(f); const d=f.contentDocument; d.open(); d.write('<script>try{history.replaceState(null,"",location.href); parent.__dw="ok "+location.href}catch(e){parent.__dw="THROW "+e.name+" "+e.message}<\\/script>'); d.close(); return window.__dw;`,
	history_push_protorel: `try { history.pushState(null,'','//'+location.host+'/pr'); return location.pathname; } catch(e){ return 'THROW '+e.name; }`,
	history_push_upper: `try { history.pushState(null,'',location.href.replace('http://','HTTP://').replace('localhost','LOCALHOST')); return location.pathname; } catch(e){ return 'THROW '+e.name; }`,
	history_push_defaultport: `try { history.pushState(null,'',location.protocol+'//'+location.hostname+':'+(location.port||80)+'/dp'); return location.pathname; } catch(e){ return 'THROW '+e.name; }`,
	history_push_js: `try { history.pushState(null,'','javascript:void 0'); return location.href; } catch(e){ return 'THROW '+e.name; }`,
	history_push_bigstate: `const big={a:new Array(1000).fill('x')}; history.pushState(big,'','/big'); return history.state.a.length;`,
	history_push_uncloneable: `try { history.pushState({f(){}},'','/unc'); return 'nothrow'; } catch(e){ return e.name; }`,
	history_push_uncloneable_url: `const before=location.pathname; try { history.pushState({f(){}},'','/unc2'); } catch(e){} return [before===location.pathname];`,
	history_state_after_nav_hook: `history.replaceState({k:1},'','/k1'); history.pushState({k:2},'','/k2'); return [history.state.k, history.length>1];`,
	history_this_iframe_cross: `const f=document.createElement('iframe'); document.body.appendChild(f); try { history.pushState.call(f.contentWindow.history, null, '', '#z'); return f.contentWindow.location.hash; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	location_assign_hash: `location.assign('#ah'); return location.hash;`,
	location_replace_hash: `location.replace('#rh'); return location.hash;`,
	location_search_hash_href: `location.href = location.pathname + location.search + '#hh'; return location.hash;`,
	perf_nav_json_name: `const e=performance.getEntriesByType('navigation')[0]; return e.toJSON().name;`,
	perf_resource_json_name: `const e=performance.getEntriesByType('resource').find(x=>x.name.includes('script.js')); return e ? e.toJSON().name : 'none';`,
	perf_mark_url_name: `performance.mark(location.origin + '/fake'); return performance.getEntriesByName(location.origin + '/fake').length;`,
	perf_measure_detail: `const m=performance.measure('md', {start:0, duration:1, detail:{a:1}}); return [m.name, m.detail && m.detail.a];`,
	perf_getEntriesByType_unknown: `return performance.getEntriesByType('nope').length;`,
	perf_getEntriesByName_nameonly_type_undefined: `performance.mark('gg'); return performance.getEntriesByName('gg', undefined).length;`,
	perf_event_timing: `return performance.getEntriesByType('paint').map(e=>e.name);`,
	perf_eventCounts: `return typeof performance.eventCounts;`,
	perf_entry_name_desc: `const d=Object.getOwnPropertyDescriptor(PerformanceEntry.prototype,'name'); return [typeof d.get, d.get.name, d.get.toString()];`,
	perf_clearmarks: `performance.mark('cm'); performance.clearMarks('cm'); return performance.getEntriesByName('cm').length;`,
	perf_observer_supported: `return PerformanceObserver.supportedEntryTypes.length>0;`,
	perf_observer_takeRecords: `const po=new PerformanceObserver(()=>{}); po.observe({type:'mark'}); performance.mark('tr'); const r=po.takeRecords(); po.disconnect(); return r.map(e=>e.name);`,
	perf_toJSON_perf: `return typeof performance.toJSON().timing;`,
	fontface_descriptor: `const f=new FontFace('X','url(/f.woff2) format("woff2")', {weight:'700', style:'italic'}); return [f.weight, f.style];`,
	fontface_noargs: `try { new FontFace(); return 'nothrow'; } catch(e){ return e.name; }`,
	fontface_call: `try { FontFace('a','b'); return 'nothrow'; } catch(e){ return e.name; }`,
	fontface_typedarray: `const f=new FontFace('X', new Uint8Array(8)); return f.family;`,
	fontface_load: `const f=new FontFace('X', 'url(/nope.woff2)'); try { await f.load(); return 'loaded'; } catch(e){ return e.name; }`,
	fontface_obj_src: `const f=new FontFace('X', {toString(){return 'url(/obj.woff2)'}}); return f.status;`,
	fontface_css_rule: `const s=document.createElement('style'); s.textContent='@font-face{font-family:Q; src:url(/q.woff2)}'; document.head.appendChild(s); const r=s.sheet.cssRules[0]; return [r.style.getPropertyValue('src'), r.style.src, r.cssText];`,
	adopted_readback: `const sh=new CSSStyleSheet(); sh.replaceSync('.a{background:url(/ad.png)}'); document.adoptedStyleSheets=[sh]; return [document.adoptedStyleSheets.length, document.adoptedStyleSheets[0]===sh, sh.cssRules[0].style.backgroundImage];`,
	import_rule: `const sh=new CSSStyleSheet(); try { sh.replaceSync('@import url(/imp.css); .a{}'); } catch(e) { return 'THROW '+e; } return [sh.cssRules.length];`,
	style_import_textcontent: `const s=document.createElement('style'); s.textContent='@import "/imp2.css";'; document.head.appendChild(s); return s.sheet.cssRules[0] ? [s.sheet.cssRules[0].href, s.sheet.cssRules[0].cssText] : 'none';`,
	settimeout_string_scope: `var __g1 = 5; window.__stsc=0; setTimeout('window.__stsc = typeof location.href + (typeof __g1)', 0); await new Promise(r=>setTimeout(r,20)); return window.__stsc;`,
	setinterval_string: `window.__si=0; const id=setInterval('window.__si++', 1); await new Promise(r=>setTimeout(r,40)); clearInterval(id); return window.__si>0;`,
	settimeout_trusted: `return typeof trustedTypes;`,
	settimeout_returns_same_as_clear: `let fired=false; const id=setTimeout(()=>{fired=true},5); clearTimeout(id); await new Promise(r=>setTimeout(r,20)); return fired;`,
	settimeout_clearInterval_cross: `let fired=false; const id=setTimeout(()=>{fired=true},5); clearInterval(id); await new Promise(r=>setTimeout(r,20)); return fired;`,
	settimeout_worker: `const w=new Worker(URL.createObjectURL(new Blob(['setTimeout((a)=>postMessage("w"+a),0,1); setTimeout("postMessage(typeof location)",0);'],{type:'text/javascript'}))); const got=[]; await new Promise(r=>{ w.onmessage=e=>{got.push(e.data); if(got.length==2) r();}; setTimeout(r,2000); }); w.terminate(); return got;`,
	settimeout_worker_this: `const w=new Worker(URL.createObjectURL(new Blob(['try { setTimeout.call(self, ()=>postMessage("ok"),0); const {setTimeout: st}=self; st(()=>postMessage("ok2"),0); } catch(e) { postMessage("ERR "+e) }'],{type:'text/javascript'}))); const got=[]; await new Promise(r=>{ w.onmessage=e=>{got.push(e.data); if(got.length==2) r();}; setTimeout(r,2000); }); w.terminate(); return got;`,
	settimeout_frozen_args: `const args=Object.freeze([1,2]); return await new Promise(r=>setTimeout((...a)=>r(a), 0, ...args));`,
	settimeout_callable_obj: `const p = new Proxy(function(){}, {}); return typeof setTimeout(p, 0);`,
	settimeout_iframe_other_realm_fn: `const f=document.createElement('iframe'); document.body.appendChild(f); return await new Promise(r=>setTimeout(new f.contentWindow.Function('return 1'), 0) && setTimeout(()=>r('ok'),5));`,
	settimeout_cross_realm_this: `const f=document.createElement('iframe'); document.body.appendChild(f); try { return await new Promise(r=>f.contentWindow.setTimeout.call(window, ()=>r('ok'), 0)); } catch(e){ return 'THROW '+e.name; }`,
	settimeout_this_parent_on_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); try { return await new Promise(r=>setTimeout.call(f.contentWindow, ()=>r('ok'), 0)); } catch(e){ return 'THROW '+e.name; }`,
	window_open_this_other: `const f=document.createElement('iframe'); document.body.appendChild(f); try { const o=window.open.call(f.contentWindow, ''); return typeof o; } catch(e){ return 'THROW '+e.name; }`,
	open3_doc: `const f=document.createElement('iframe'); document.body.appendChild(f); return typeof f.contentDocument.open;`,
	frameElement_srcdoc_nested: `const f=document.createElement('iframe'); f.srcdoc='<iframe srcdoc="x"></iframe>'; document.body.appendChild(f); await new Promise(r=>f.onload=r); const inner=f.contentDocument.querySelector('iframe'); await new Promise(r=> inner.contentDocument.readyState==='complete'?r():inner.onload=r); return [inner.contentWindow.frameElement===inner];`,
	frameElement_blob: `const f=document.createElement('iframe'); f.src=URL.createObjectURL(new Blob(['<p>b</p>'],{type:'text/html'})); document.body.appendChild(f); await new Promise(r=>f.onload=r); try { return [f.contentWindow.frameElement===f]; } catch(e){ return 'THROW '+e.name; }`,
	frameElement_same_site_frame: `const f=document.createElement('iframe'); f.src='/nope404'; document.body.appendChild(f); await new Promise(r=>f.onload=r); try { return [f.contentWindow.frameElement===f]; } catch(e){ return 'THROW '+e.name; }`,
	history_push_int: `history.pushState(null,'',0); return location.pathname;`,
};

export default [
	basicTest({
		name: "rv7-probe2",
		autoPass: false,
		js: `
		const probes = {${Object.entries(probes)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {};
		for (const [k, v] of Object.entries(probes)) {
			console.log('RV7STEP ' + k);
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

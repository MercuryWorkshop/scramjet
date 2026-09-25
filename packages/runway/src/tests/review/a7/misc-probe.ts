import { basicTest } from "../../../testcommon.ts";

const probes: Record<string, string> = {
	revoke_garbage: `try { URL.revokeObjectURL('garbage'); return 'ok'; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	revoke_undefined: `try { URL.revokeObjectURL(undefined); return 'ok'; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	revoke_empty: `try { URL.revokeObjectURL(''); return 'ok'; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	revoke_https: `try { URL.revokeObjectURL('https://example.com/x'); return 'ok'; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	revoke_foreign_blob: `try { URL.revokeObjectURL('blob:https://other.example/0000'); return 'ok'; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	revoke_noargs: `try { URL.revokeObjectURL(); return 'ok'; } catch(e){ return 'THROW '+e.name; }`,
	create_revoke_fetch: `const u=URL.createObjectURL(new Blob(['hi'])); const r=await fetch(u); const t=await r.text(); URL.revokeObjectURL(u); return [u.startsWith('blob:'+location.origin), t];`,
	create_obj_url_mediasource: `if (!self.MediaSource) return 'n/a'; const u=URL.createObjectURL(new MediaSource()); return u.startsWith('blob:'+location.origin);`,
	create_obj_url_bad: `try { URL.createObjectURL({}); return 'nothrow'; } catch(e){ return e.name; }`,
	create_obj_url_file: `const u=URL.createObjectURL(new File(['x'],'a.txt')); return u.startsWith('blob:'+location.origin);`,
	blob_img: `const c=document.createElement('canvas'); c.width=c.height=2; const b=await new Promise(r=>c.toBlob(r)); const u=URL.createObjectURL(b); const img=new Image(); img.src=u; await img.decode(); return [img.width, img.src===u];`,
	sendBeacon: `return navigator.sendBeacon('/beacon', 'x');`,
	sendBeacon_unbound: `const sb = navigator.sendBeacon; try { sb('/b'); return 'nothrow'; } catch(e) { return e.name; }`,
	sendBeacon_bound: `const sb = navigator.sendBeacon.bind(navigator); return sb('/b2', new Blob(['a']));`,
	audio: `const a=new Audio('/a.mp3'); return [a.src, a.getAttribute('src')];`,
	audio_empty: `const a=new Audio(); return [a.src, a.hasAttribute('src')];`,
	audio_sub: `class A extends Audio {}; const a=new A('/b.mp3'); return [a instanceof A, a instanceof HTMLAudioElement, a.src];`,
	audio_call: `try { Audio('/x'); return 'nothrow'; } catch(e){ return e.name; }`,
	audio_proto: `return [Audio.prototype === HTMLAudioElement.prototype, new Audio() instanceof Audio, Audio.name, Audio.length];`,
	registerProtocolHandler: `try { navigator.registerProtocolHandler('web+x', location.origin + '/?q=%s'); return 'ok'; } catch(e){ return 'THROW '+e.name; }`,
	range_ccf: `const r=document.createRange(); r.selectNode(document.body); const f=r.createContextualFragment('<img src="/rc.png"><a href="/ra">x</a>'); return [f.querySelector('img').getAttribute('src'), f.querySelector('a').href];`,
	range_ccf_svg: `const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.appendChild(s); const r=document.createRange(); r.selectNodeContents(s); const f=r.createContextualFragment('<image href="/si.png"/>'); return [f.firstChild.namespaceURI, f.firstChild.getAttribute('href')];`,
	range_toString: `const p=document.createElement('p'); p.textContent='hello world'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,2); r.setEnd(p.firstChild,7); return r.toString();`,
	range_style_toString: `const s=document.createElement('style'); s.textContent='.a{background:url(/q.png)}'; document.body.appendChild(s); const r=document.createRange(); r.selectNodeContents(s); return [r.toString(), r.endOffset];`,
	range_body_toString: `const r=document.createRange(); r.selectNodeContents(document.body); return r.toString().includes('/~/sj/');`,
	range_offsets_perf_ms: `const p=document.createElement('p'); p.textContent='hello world'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,2); r.setEnd(p.firstChild,7); const t=performance.now(); let s=0; for(let i=0;i<200000;i++){ s+=r.startOffset+r.endOffset; } return Math.round(performance.now()-t);`,
	range_tostring_perf_ms: `const r=document.createRange(); r.selectNodeContents(document.body); const t=performance.now(); for(let i=0;i<2000;i++){ r.toString(); } return Math.round(performance.now()-t);`,
	selection_offsets_perf_ms: `const p=document.createElement('p'); p.textContent='hello world'; document.body.appendChild(p); const sel=getSelection(); sel.collapse(p.firstChild, 3); const t=performance.now(); let s=0; for(let i=0;i<50000;i++){ const r=sel.getRangeAt(0); s+=r.startOffset; } return Math.round(performance.now()-t);`,
	range_insertNode: `const p=document.createElement('p'); p.textContent='abcdef'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,3); r.collapse(true); const b=document.createElement('b'); b.textContent='X'; r.insertNode(b); return p.innerHTML;`,
	range_surround: `const p=document.createElement('p'); p.textContent='abcdef'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,1); r.setEnd(p.firstChild,3); r.surroundContents(document.createElement('i')); return p.innerHTML;`,
	range_extract: `const p=document.createElement('p'); p.innerHTML='a<b>bc</b>d'; document.body.appendChild(p); const r=document.createRange(); r.setStart(p.firstChild,0); r.setEnd(p.lastChild,1); const f=r.extractContents(); return [p.innerHTML, f.childNodes.length];`,
	staticrange: `const p=document.createElement('p'); p.textContent='abc'; document.body.appendChild(p); const sr=new StaticRange({startContainer:p.firstChild,startOffset:1,endContainer:p.firstChild,endOffset:2}); return [sr.startOffset, sr.endOffset];`,
	doc_domain_set_suffix: `try { document.domain = 'calhost'; return 'nothrow'; } catch(e){ return e.name; }`,
	doc_domain_set_ip: `try { document.domain = '127.0.0.1'; return 'nothrow'; } catch(e){ return e.name; }`,
	doc_domain_getter_other: `const f=document.createElement('iframe'); document.body.appendChild(f); return f.contentDocument.domain;`,
	doc_referrer_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); return f.contentDocument.referrer;`,
	doc_url_iframe_nav: `const f=document.createElement('iframe'); f.src='/nope'; document.body.appendChild(f); await new Promise(r=>f.onload=r); return [f.contentDocument.URL, f.contentWindow.location.href, f.contentDocument.referrer];`,
	doc_URL_foreign_call: `const f=document.createElement('iframe'); f.src='/nope2'; document.body.appendChild(f); await new Promise(r=>f.onload=r); const g=Object.getOwnPropertyDescriptor(Document.prototype,'URL').get; return g.call(f.contentDocument);`,
	doc_write_parent_into_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); const d=f.contentDocument; d.open(); d.write('<script src="/w.js"><\\/script><a href="/wa">x</a>'); d.close(); return [d.querySelector('a').href, d.querySelector('script').getAttribute('src')];`,
	doc_write_trusted: `if (!self.trustedTypes) return 'n/a'; const p=trustedTypes.createPolicy('p'+Math.random(), {createHTML:s=>s}); const f=document.createElement('iframe'); document.body.appendChild(f); const d=f.contentDocument; d.open(); d.write(p.createHTML('<i>t</i>')); d.close(); return d.body.innerHTML;`,
	doc_open_window: `const f=document.createElement('iframe'); document.body.appendChild(f); const w=f.contentDocument.open('about:blank','_self',''); return [typeof w, w===f.contentWindow];`,
	doc_execCommand_bold: `const d=document.createElement('div'); d.contentEditable='true'; d.textContent='abc'; document.body.appendChild(d); const r=document.createRange(); r.selectNodeContents(d); getSelection().removeAllRanges(); getSelection().addRange(r); return [document.execCommand('bold'), d.innerHTML];`,
	doc_execCommand_iframe_doc: `const f=document.createElement('iframe'); document.body.appendChild(f); const d=f.contentDocument; d.designMode='on'; d.body.innerHTML='abc'; d.body.focus(); const r=d.createRange(); r.selectNodeContents(d.body); r.collapse(false); d.getSelection().removeAllRanges(); d.getSelection().addRange(r); const ok=d.execCommand('insertText', false, 'Z'); return [ok, d.body.innerHTML];`,
	doc_execCommand_insertHTML: `const d=document.createElement('div'); d.contentEditable='true'; document.body.appendChild(d); d.focus(); document.execCommand('insertHTML', false, '<img src="/ih.png">'); const i=d.querySelector('img'); return i ? [i.getAttribute('src'), i.src] : 'none';`,
	doc_execCommand_insertText_null: `const t=document.createElement('textarea'); document.body.appendChild(t); t.focus(); return [document.execCommand('insertText'), t.value];`,
	doc_createElement_img: `const i=document.createElement('img'); i.src='/ce.png'; return [i.src, i.getAttribute('src')];`,
	doc_currentScript_inline: `return 'skip';`,
	doc_hasFocus: `return typeof document.hasFocus();`,
	doc_cookie_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); f.contentDocument.cookie='ifc=1'; return document.cookie.includes('ifc=1');`,
	doc_title: `document.title='T'; return document.title;`,
	doc_lastModified: `return typeof document.lastModified;`,
	doc_parseHTMLUnsafe_opts: `if (!Document.parseHTMLUnsafe) return 'n/a'; const d=Document.parseHTMLUnsafe('<p>x</p>', {}); return d.body.innerHTML;`,
	doc_parseHTML: `if (!Document.parseHTML) return 'n/a'; const d=Document.parseHTML('<img src="/ph.png">'); return d.querySelector('img') ? d.querySelector('img').getAttribute('src') : 'none';`,
	setHTMLUnsafe: `const d=document.createElement('div'); if (!d.setHTMLUnsafe) return 'n/a'; d.setHTMLUnsafe('<img src="/shu.png">'); return [d.querySelector('img').getAttribute('src'), d.querySelector('img').src];`,
	import_meta_perf: `return typeof performance.memory;`,
	perf_timeOrigin: `return performance.timeOrigin > 0;`,
	perf_navigation_toJSON_keys: `const j=performance.getEntriesByType('navigation')[0].toJSON(); return Object.keys(j).includes('serverTiming');`,
	perf_entry_proxy_name_foreign: `const f=document.createElement('iframe'); document.body.appendChild(f); const e=performance.getEntriesByType('navigation')[0]; const g=Object.getOwnPropertyDescriptor(f.contentWindow.PerformanceEntry.prototype,'name').get; return g.call(e).includes('/~/');`,
	perf_resource_css_img: `const i=new Image(); i.src='/pri.png?x=1'; await new Promise(r=>{i.onerror=i.onload=r}); await new Promise(r=>setTimeout(r,50)); const e=performance.getEntriesByName(location.origin+'/pri.png?x=1'); return [e.length, e[0] && e[0].initiatorType];`,
	perf_getEntriesByName_relative: `return performance.getEntriesByName('/script.js').length;`,
	perf_resource_masked: `return performance.getEntriesByType('resource').filter(e=>/scramjet|sw\\.js|wasm/i.test(e.name)).map(e=>e.name);`,
	perf_serverTiming: `const e=performance.getEntriesByType('navigation')[0]; return Array.isArray(e.serverTiming);`,
	perf_observer_nav: `return await new Promise(r=>{ const po=new PerformanceObserver(l=>{ po.disconnect(); r(l.getEntries().map(e=>e.name.includes('/~/'))); }); po.observe({type:'navigation', buffered:true}); setTimeout(()=>r('none'),1000); });`,
	perf_LCP: `return await new Promise(r=>{ const po=new PerformanceObserver(l=>{ po.disconnect(); const e=l.getEntries()[0]; r([e.entryType, typeof e.url, (e.url||'').includes('/~/')]); }); po.observe({type:'largest-contentful-paint', buffered:true}); setTimeout(()=>r('none'),1000); });`,
	perf_element_url: `const i=new Image(); i.src='/lcp.png'; i.setAttribute('elementtiming','x'); document.body.appendChild(i); return 'skip';`,
};

export default [
	basicTest({
		name: "rv7-misc-probe",
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

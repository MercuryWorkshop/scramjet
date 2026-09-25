import { basicTest } from "../../../testcommon.ts";

const P: Record<string, string> = {
	sync_xhr_top: `const x=new XMLHttpRequest(); try { x.open('GET','/script.js',false); x.send(); return [x.status, x.responseText.length>10]; } catch(e){ return 'THROW '+e.name+': '+e.message; }`,
	sync_xhr_blank_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); try { return f.contentWindow.eval('(()=>{ const x=new XMLHttpRequest(); x.open("GET","/script.js",false); x.send(); return x.status; })()'); } catch(e){ return 'THROW '+e.name+': '+e.message; }`,
	fetch_blank_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); const r=await f.contentWindow.fetch('/script.js'); return [r.status, r.url];`,
	fetch_blank_iframe_eval: `const f=document.createElement('iframe'); document.body.appendChild(f); const r=await f.contentWindow.eval('fetch("/script.js")'); return [r.status, r.url];`,
	ce_acc_values: `const log=[]; class A extends HTMLElement { static observedAttributes=['src','href','style','onclick','srcset','action','target','sandbox','data','poster']; attributeChangedCallback(n,o,v){ log.push(n+':'+o+'->'+v); } } customElements.define('rv-accv', A); const a=document.createElement('rv-accv'); for (const n of ['src','href','style','onclick','srcset','action','target','sandbox','data','poster']) { a.setAttribute(n, n==='onclick'?'go()':(n==='style'?'color:red':(n==='srcset'?'/s.png 2x':(n==='target'?'_top':(n==='sandbox'?'allow-scripts':'/'+n))))); } for (const n of ['src','onclick','style']) a.setAttribute(n, n==='onclick'?'go2()':'/'+n+'2'); for (const n of ['src','onclick']) a.removeAttribute(n); return log;`,
	ce_acc_markup: `const log=[]; class B extends HTMLElement { static observedAttributes=['onclick','href','src']; attributeChangedCallback(n,o,v){ log.push(n+':'+o+'->'+v); } } customElements.define('rv-accm', B); const d=document.createElement('div'); d.innerHTML='<rv-accm onclick="go()" href="/h" src="/s"></rv-accm>'; document.body.appendChild(d); return log;`,
	ce_acc_prop: `const log=[]; class C extends HTMLElement { static observedAttributes=['onclick']; attributeChangedCallback(n,o,v){ log.push(n+':'+o+'->'+v); } } customElements.define('rv-accp', C); const c=document.createElement('rv-accp'); c.onclick=()=>{}; c.setAttribute('onclick','a()'); return log;`,
	ce_builtin_a_acc: `const log=[]; class D extends HTMLAnchorElement { static observedAttributes=['href','target','onclick']; attributeChangedCallback(n,o,v){ log.push(n+':'+o+'->'+v); } } customElements.define('rv-acca', D, {extends:'a'}); const a=document.createElement('a',{is:'rv-acca'}); a.href='/x'; a.target='_top'; a.setAttribute('onclick','f()'); return log;`,
	mo_oldvalue: `const d=document.createElement('a'); document.body.appendChild(d); d.setAttribute('href','/o1'); d.setAttribute('onclick','o1()'); d.setAttribute('style','color:red'); const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributes:true, attributeOldValue:true}); d.setAttribute('href','/o2'); d.setAttribute('onclick','o2()'); d.setAttribute('style','color:blue'); d.href='/o3'; await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.attributeName+':'+r.oldValue);`,
	mo_oldvalue_filter: `const d=document.createElement('img'); document.body.appendChild(d); d.src='/f1.png'; const recs=[]; const mo=new MutationObserver(r=>recs.push(...r)); mo.observe(d,{attributeFilter:['src'], attributeOldValue:true}); d.src='/f2.png'; await new Promise(r=>setTimeout(r,10)); return recs.map(r=>r.attributeName+':'+r.oldValue);`,
};

export default [
	basicTest({
		name: "rv7-subclass3-probe",
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

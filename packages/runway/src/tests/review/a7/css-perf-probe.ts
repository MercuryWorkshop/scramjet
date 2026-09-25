import { basicTest } from "../../../testcommon.ts";

const probes: Record<string, string> = {
	gcs_gpv_ms: `const d=document.createElement('div'); document.body.appendChild(d); const cs=getComputedStyle(d); const t=performance.now(); let n=0; for(let i=0;i<100000;i++){ n+=cs.getPropertyValue('width').length; } return Math.round(performance.now()-t);`,
	style_gpv_ms: `const d=document.createElement('div'); d.style.width='3px'; const t=performance.now(); let n=0; for(let i=0;i<100000;i++){ n+=d.style.getPropertyValue('width').length; } return Math.round(performance.now()-t);`,
	style_access_ms: `const d=document.createElement('div'); const t=performance.now(); let n=0; for(let i=0;i<100000;i++){ n+=d.style.length; } return Math.round(performance.now()-t);`,
	settimeout_ms: `const t=performance.now(); for(let i=0;i<50000;i++){ clearTimeout(setTimeout(()=>{}, 1000)); } return Math.round(performance.now()-t);`,
	pushstate_ms: `const t=performance.now(); for(let i=0;i<2000;i++){ history.replaceState(null,'','/r'+(i%10)); } return Math.round(performance.now()-t);`,
	getEntriesByType_res_ms: `for(let i=0;i<200;i++){ const im=new Image(); im.src='/res'+i+'.png'; } await new Promise(r=>setTimeout(r,500)); const t=performance.now(); for(let i=0;i<200;i++){ performance.getEntriesByType('resource'); } return Math.round(performance.now()-t);`,
	perf_name_ms: `const es=performance.getEntriesByType('resource'); const t=performance.now(); let n=0; for(let i=0;i<200;i++){ for(const e of es) n+=e.name.length; } return Math.round(performance.now()-t);`,
	cssText_get_ms: `const d=document.createElement('div'); d.style.cssText='color:red;background:url(/x.png)'; const t=performance.now(); let n=0; for(let i=0;i<50000;i++){ n+=d.style.cssText.length; } return Math.round(performance.now()-t);`,
	new_elem_style_ms: `const t=performance.now(); for(let i=0;i<20000;i++){ const d=document.createElement('div'); d.style.color='red'; } return Math.round(performance.now()-t);`,
	textnode_style_1000_ms: `const s=document.createElement('style'); document.head.appendChild(s); const t=performance.now(); for(let i=0;i<1000;i++){ s.appendChild(document.createTextNode('.e'+i+'{color:red}')); } return Math.round(performance.now()-t);`,
	textnode_style_3000_ms: `const s=document.createElement('style'); document.head.appendChild(s); const t=performance.now(); for(let i=0;i<3000;i++){ s.appendChild(document.createTextNode('.f'+i+'{color:red}')); } return Math.round(performance.now()-t);`,
	style_textContent_append_ms: `const s=document.createElement('style'); document.head.appendChild(s); const t=performance.now(); for(let i=0;i<1000;i++){ s.textContent += '.g'+i+'{color:red}'; } return Math.round(performance.now()-t);`,
	style_perf_ms: `const d=document.createElement('div'); document.body.appendChild(d); const t=performance.now(); for(let i=0;i<20000;i++){ d.style.transform='translateX('+i+'px)'; } return Math.round(performance.now()-t);`,
	style_perf_withattr_ms: `const d=document.createElement('div'); d.setAttribute('style','color:red; background:url(/x.png)'); document.body.appendChild(d); const t=performance.now(); for(let i=0;i<20000;i++){ d.style.transform='translateX('+i+'px)'; } return Math.round(performance.now()-t);`,
	style_perf_big_ms: `const d=document.createElement('div'); let css=''; for (let i=0;i<40;i++) css+='--v'+i+': url(/img'+i+'.png);'; d.setAttribute('style', css); document.body.appendChild(d); const t=performance.now(); for(let i=0;i<5000;i++){ d.style.left=i+'px'; } return Math.round(performance.now()-t);`,
	setprop_perf_ms: `const d=document.createElement('div'); document.body.appendChild(d); const t=performance.now(); for(let i=0;i<20000;i++){ d.style.setProperty('--x', String(i)); } return Math.round(performance.now()-t);`,
	style_read_perf_ms: `const d=document.createElement('div'); document.body.appendChild(d); d.style.width='3px'; const t=performance.now(); let s=0; for(let i=0;i<100000;i++){ s+=d.style.width.length; } return Math.round(performance.now()-t);`,
	style_getter_perf_ms: `const els=[]; for(let i=0;i<2000;i++){ const d=document.createElement('div'); document.body.appendChild(d); els.push(d);} const t=performance.now(); for(let k=0;k<10;k++) for(const d of els){ d.style.opacity='0.5'; } return Math.round(performance.now()-t);`,
	insertRule_perf_ms: `const s=document.createElement('style'); document.head.appendChild(s); const t=performance.now(); for(let i=0;i<5000;i++){ s.sheet.insertRule('.c'+i+'{color:red;padding:'+i+'px}', s.sheet.cssRules.length); } return Math.round(performance.now()-t);`,
	textnode_style_perf_ms: `const s=document.createElement('style'); document.head.appendChild(s); const t=performance.now(); for(let i=0;i<2000;i++){ s.appendChild(document.createTextNode('.d'+i+'{color:red}')); } return Math.round(performance.now()-t);`,
};

export default [
	Object.assign(
		basicTest({
			name: "rv7-perfprobe",
			autoPass: false,
			js: `
		const probes = {${Object.entries(probes)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {};
		for (const [k, v] of Object.entries(probes)) {
			console.log('RV7STEP ' + k);
			try {
				const res = await Promise.race([v(), new Promise(r=>setTimeout(()=>r("TIMEOUT"), 20000))]);
				out[k] = JSON.stringify(res);
			} catch (e) {
				out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message);
			}
		}
		console.log('RV7PROBE ' + JSON.stringify(out));
		fail('RV7PROBE ' + JSON.stringify(out));
		`,
		}),
		{
			timeoutMs: 180000,
		}
	),
];

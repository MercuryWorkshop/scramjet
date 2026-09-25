import { htmlTest } from "../../../testcommon.ts";

// document-level selector matching against markup that came from the server
const probes: Record<string, string> = {
	href_hash: `return document.querySelectorAll('a[href^="#"]').length;`,
	href_eq: `return [document.querySelectorAll('a[href="/rel"]').length, document.querySelectorAll('a[href="#top"]').length];`,
	href_abs: `return document.querySelectorAll('a[href^="https://example.com"]').length;`,
	href_contains: `return document.querySelectorAll('a[href*="example"]').length;`,
	script_src: `return [document.querySelectorAll('script[src*="app.js"]').length, !!document.querySelector('script[src$="app.js"]')];`,
	style_attr_markup: `return [document.querySelectorAll('[style]').length, document.querySelectorAll('[style*="display: none"]').length, document.querySelectorAll('div[style*="url("]').length];`,
	style_attr_js: `const d=document.createElement('div'); d.style.display='none'; d.className='jsd'; document.body.appendChild(d); return [document.querySelectorAll('.jsd[style]').length, document.querySelectorAll('.jsd[style*="display: none"]').length];`,
	style_attr_inner: `const h=document.createElement('div'); h.innerHTML='<p class="ih" style="color: red">x</p>'; document.body.appendChild(h); return [document.querySelectorAll('.ih[style]').length, document.querySelectorAll('.ih[style*="red"]').length];`,
	style_attr_clone: `const c=document.querySelector('#styled').cloneNode(true); c.id='cl'; document.body.appendChild(c); return [document.querySelectorAll('#cl[style*="display: none"]').length];`,
	style_attr_removed: `const d=document.createElement('div'); d.className='rm'; d.style.color='red'; document.body.appendChild(d); d.removeAttribute('style'); return document.querySelectorAll('.rm[style]').length;`,
	style_attr_cssom_cleared: `const d=document.createElement('div'); d.className='cl2'; d.style.color='red'; document.body.appendChild(d); d.style.color=''; return [d.getAttribute('style'), document.querySelectorAll('.cl2[style=""]').length, document.querySelectorAll('.cl2[style]').length];`,
	img_src: `return [document.querySelectorAll('img[src="/i.png"]').length, document.querySelectorAll('img[src]').length];`,
	not_href: `return document.querySelectorAll('a:not([href^="#"])').length;`,
	is_href: `return document.querySelectorAll(':is(a[href="#top"], img[src="/i.png"])').length;`,
	target_blank: `return document.querySelectorAll('a[target="_blank"]').length;`,
	meta_content: `return document.querySelectorAll('meta[name="viewport"][content*="width"]').length;`,
	link_href: `return document.querySelectorAll('link[rel="stylesheet"][href*="s.css"]').length;`,
	onclick: `return document.querySelectorAll('[onclick]').length;`,
	data_attr: `return document.querySelectorAll('[data-x="1"]').length;`,
	qs_perf_ms: `const t=performance.now(); for (let i=0;i<20000;i++) document.querySelector('.nope-'+(i%10)); return Math.round(performance.now()-t);`,
	qs_attr_perf_ms: `const t=performance.now(); for (let i=0;i<20000;i++) document.querySelector('a[href="#top"]'); return Math.round(performance.now()-t);`,
	gebi_perf_ms: `const t=performance.now(); for (let i=0;i<20000;i++) document.getElementById('styled'); return Math.round(performance.now()-t);`,
	matches_perf_ms: `const a=document.querySelector('a'); const t=performance.now(); for (let i=0;i<20000;i++) a.matches('.x, a[href]'); return Math.round(performance.now()-t);`,
};

export default [
	htmlTest({
		name: "rv7-selectors-probe",
		html: `<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/s.css"></head><body>
<a href="#top">top</a><a href="/rel">rel</a><a href="https://example.com/x" target="_blank">ex</a>
<img src="/i.png"><div id="styled" style="display: none; background: url(/bg.png)"></div><div style="color: red"></div>
<button onclick="void 0">b</button><div data-x="1"></div>
<script src="/app.js"></script>
<script>
runTest(async () => {
	const probes = {${Object.entries(probes)
		.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
		.join(",\n")}};
	const out = {};
	for (const [k, v] of Object.entries(probes)) {
		try { out[k] = JSON.stringify(await v()); } catch (e) { out[k] = 'THROW ' + e.name + ': ' + e.message; }
	}
	console.log('RV7PROBE ' + JSON.stringify(out));
	fail('RV7PROBE ' + JSON.stringify(out));
}, false);
</script></body></html>`,
	}),
];

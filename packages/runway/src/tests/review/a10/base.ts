import { probeTest } from "./lib.ts";

const common: Record<string, string> = {
	a_href: `const a=document.createElement('a'); a.href='x/y.html'; return a.href;`,
	a_href_attr: `const a=document.createElement('a'); a.setAttribute('href','x/y.html'); return [a.href, a.getAttribute('href')];`,
	img_src: `const i=document.createElement('img'); i.src='img.png'; return i.src;`,
	innerhtml_a: `const d=document.createElement('div'); d.innerHTML='<a href="z.html">z</a>'; return d.firstChild.href;`,
	fetch_rel: `const r=await fetch('echo/rel'); return [await r.text(), r.url];`,
	script_load: `const s=document.createElement('script'); s.src='chunk.js'; const p=new Promise(r=>{s.onload=()=>r('load');s.onerror=()=>r('error')}); document.head.appendChild(s); const x=await p; return [x, window.__loaded];`,
	baseURI: `return document.baseURI;`,
	new_url_baseuri: `return new URL('q', document.baseURI).href;`,
	parsed_a: `return document.getElementById('pa') ? document.getElementById('pa').href : null;`,
};

export default [
	probeTest({
		name: "rv10-base-relative-dot",
		head: `<base href="./">`,
		probes: common,
	}),
	probeTest({
		name: "rv10-base-relative-sub",
		head: `<base href="assets/">`,
		probes: common,
	}),
	probeTest({
		name: "rv10-base-none",
		probes: common,
	}),
];

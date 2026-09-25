import { probeTest } from "./lib.ts";

const probes = {
	img_read: `const i = document.createElement('img'); i.src = 'bx.png'; return i.src.replace(location.origin, 'O');`,
	img_load: `const i = document.createElement('img'); const p = new Promise(r => { i.onload = () => r('load'); i.onerror = () => r('error'); }); i.src = 'bx.png'; document.body.appendChild(i); await p; return performance.getEntriesByType('resource').map(e => e.name.replace(location.origin, 'O')).filter(n => n.includes('bx.png'));`,
	fetch_rel: `const r = await fetch('echo/bx'); return await r.text();`,
	parsed_img: `return document.getElementById('pi').src.replace(location.origin, 'O');`,
	baseURI: `return document.baseURI.replace(location.origin, 'O');`,
};

export default [
	probeTest({
		name: "rv11-base-target-then-href",
		head: `<base target="_blank"><base href="/b3/">`,
		body: `<img id=pi src="parsed.png">`,
		probes,
	}),
	probeTest({
		name: "rv11-base-two-hrefs",
		head: `<base href="/b1/"><base href="/b2/">`,
		body: `<img id=pi src="parsed.png">`,
		probes,
	}),
];

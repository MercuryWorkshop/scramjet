import { probeTest } from "./lib.ts";

const waitFrame = `const f = document.createElement('iframe'); f.srcdoc = SRC; const p = new Promise(r => f.onload = r); document.body.appendChild(f); await p; await new Promise(r => setTimeout(r, 400)); const d = f.contentDocument;`;

export default [
	probeTest({
		name: "rv11-srcdoc-relative",
		probes: {
			img: `const SRC = '<img id=i src="rel.png"><a id=a href="rel/link">l</a><script src="rel-srcdoc.js"></script>'; ${waitFrame} return [d.getElementById('i').src, d.getElementById('a').href, f.contentWindow.__loaded, performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('rel')).concat(f.contentWindow.performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('rel')))];`,
			fetch_in: `const SRC = '<script>window.r = fetch("echo/sd").then(r => r.text())<\\/script>'; ${waitFrame} return await f.contentWindow.r;`,
			baseURI: `const SRC = '<p>x</p>'; ${waitFrame} return d.baseURI;`,
			script_insert: `const SRC = '<p>x</p>'; ${waitFrame} const s = d.createElement('script'); s.src = 'dyn-srcdoc.js'; const q = new Promise(r => { s.onload = () => r('load'); s.onerror = () => r('error'); }); d.body.appendChild(s); return [await q, f.contentWindow.__loaded];`,
		},
	}),
];

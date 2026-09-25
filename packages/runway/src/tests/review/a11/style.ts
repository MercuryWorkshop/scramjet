import { probeTest } from "./lib.ts";

export default [
	probeTest({
		name: "rv11-style-putforwards",
		body: `<div id=d1 style="color: red"></div><div id=d2></div><textarea id=ta style="width: 100px"></textarea>`,
		probes: {
			fresh_assign: `const d=document.getElementById('d2'); d.style="background-image: url(/pf1.png)"; return [d.getAttribute('style'), d.style.backgroundImage];`,
			parsed_assign: `const d=document.getElementById('d1'); d.style="color: blue; background-image: url(/pf2.png)"; return [d.getAttribute('style'), d.style.color, d.outerHTML];`,
			parsed_assign_req: `await new Promise(r=>setTimeout(r,300)); return performance.getEntriesByType('resource').filter(e=>e.name.includes('pf')).map(e=>e.name);`,
			parsed_sel: `return [document.querySelectorAll('[style*="blue"]').length, document.querySelectorAll('[style*="red"]').length];`,
		},
	}),
];

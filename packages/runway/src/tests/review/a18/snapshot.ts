import { probeTest } from "./harness.ts";

// cssAttributesFor snapshots the own names of the FIRST declaration of each
// "kind". Several rule styles share the "CSSStyleProperties" kind with element
// style; if one has a different own-name set, reading it first poisons the
// snapshot for every element in the realm. Each probe runs in a fresh iframe
// (fresh client => fresh snapshot) and touches a rule's style BEFORE any
// element style.
const inFrame = (first: string) => `
const f=document.createElement('iframe'); f.src='/sub.html?r=none'; document.body.appendChild(f); await new Promise(r=>f.onload=r);
const w=f.contentWindow, doc=f.contentDocument;
const s=doc.createElement('style'); s.textContent='@page{margin:1cm} @keyframes k{from{color:red}} .n{color:red; &:hover{color:blue} color:green} @font-face{font-family:Z; src:url(/z.woff2)} .plain{color:red}'; doc.head.appendChild(s);
const rules=s.sheet.cssRules;
const counts={};
${first}
const d=doc.createElement('div'); d.style.cssText='width:4px;height:4px'; doc.body.appendChild(d);
d.style.backgroundImage='url(/img/'+R+'-snap_'+${JSON.stringify("X")}+'.png)';
return [counts, d.style.backgroundImage, d.getAttribute('style')];`;

const probes: Record<string, string> = {
	own_counts: `const s=document.createElement('style'); s.textContent='@page{margin:1cm} @keyframes k{from{color:red}} .n{color:red; &:hover{color:blue} color:green} @font-face{font-family:Z; src:url(/z.woff2)} .plain{color:red}'; document.head.appendChild(s); const r=s.sheet.cssRules; const c=(st)=>Object.getOwnPropertyNames(st).filter(n=>!/^\\d+$/.test(n)).length; return {element:c(document.createElement('div').style), page:c(r[0].style), keyframe:c(r[1].cssRules[0].style), nested: r[2].cssRules[1] ? c(r[2].cssRules[1].style) : 'none', fontface:c(r[3].style), plain:c(r[4].style), svg:c(document.createElementNS('http://www.w3.org/2000/svg','rect').style), pageHasBg: Object.getOwnPropertyNames(r[0].style).includes('backgroundImage'), pageCtor: r[0].style.constructor.name, kfCtor: r[1].cssRules[0].style.constructor.name};`,
	first_page: inFrame(`counts.page = rules[0].style.margin;`).replace(
		'"X"',
		'"page"'
	),
	first_keyframe: inFrame(
		`counts.kf = rules[1].cssRules[0].style.color;`
	).replace('"X"', '"kf"'),
	first_nested: inFrame(
		`counts.nested = rules[2].cssRules[1] && rules[2].cssRules[1].style.color;`
	).replace('"X"', '"nested"'),
	first_plain: inFrame(`counts.plain = rules[4].style.color;`).replace(
		'"X"',
		'"plain"'
	),
	first_element: inFrame(``).replace('"X"', '"element"'),
};

export default [
	probeTest("rv18-snapshot", probes, {
		settle: 1500,
	}),
];

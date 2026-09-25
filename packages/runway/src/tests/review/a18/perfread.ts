import { probeTest } from "./harness.ts";

// Read-side CSSOM costs (ms), which bucket 1 #18 (writes) doesn't cover.
const time = (setup: string, body: string, n: number) =>
	`${setup}; const ts=[]; for(let rep=0;rep<3;rep++){ const t=performance.now(); for(let i=0;i<${n};i++){ ${body} } ts.push(performance.now()-t); } return Math.round(Math.min(...ts));`;
const probes: Record<string, string> = {
	computed_gpv: time(
		`const d=mk(); const cs=getComputedStyle(d); let x=0`,
		`x+=cs.getPropertyValue('width').length;`,
		100000
	),
	computed_gpv_bgimage: time(
		`const d=mk(); d.style.backgroundImage='url(/img/'+R+'-pr.png)'; const cs=getComputedStyle(d); let x=0`,
		`x+=cs.getPropertyValue('background-image').length;`,
		20000
	),
	computed_prop: time(
		`const d=mk(); const cs=getComputedStyle(d); let x=0`,
		`x+=cs.width.length;`,
		100000
	),
	gcs_call: time(
		`const d=mk(); let x=0`,
		`x+=getComputedStyle(d).display.length;`,
		50000
	),
	inline_gpv: time(
		`const d=mk(); d.style.color='red'; let x=0`,
		`x+=d.style.getPropertyValue('color').length;`,
		100000
	),
	inline_cssText_get: time(
		`const d=mk(); d.style.color='red'; let x=0`,
		`x+=d.style.cssText.length;`,
		50000
	),
	inline_prop_get: time(
		`const d=mk(); d.style.color='red'; let x=0`,
		`x+=d.style.color.length;`,
		100000
	),
	inline_length_item: time(
		`const d=mk(); d.style.color='red'; let x=0`,
		`for(let j=0;j<d.style.length;j++) x+=d.style.item(j).length;`,
		20000
	),
	rule_cssText: time(
		`const sh=inl(); sh.insertRule('.rct{color:red; background:url(/img/x.png)}'); const r=sh.cssRules[0]; let x=0`,
		`x+=r.cssText.length;`,
		50000
	),
	sheet_scan: time(
		`const sh=inl(); for(let i=0;i<300;i++) sh.insertRule('.sc'+i+'{color:red}'); let x=0`,
		`for(const r of sh.cssRules) x+=r.selectorText.length;`,
		50
	),
	sheet_scan_style: time(
		`const sh=inl(); for(let i=0;i<300;i++) sh.insertRule('.ss'+i+'{color:red}'); let x=0`,
		`for(const r of sh.cssRules) x+=r.style.getPropertyValue('color').length;`,
		50
	),
	jquery_css_like: time(
		`const d=mk(); let x=0`,
		`const cs=getComputedStyle(d); x+=(cs.getPropertyValue('width')||cs.width).length; d.style.width=(i%50)+'px';`,
		20000
	),
};

export default [
	probeTest("rv18-perfread", probes, {
		timeout: 30000,
		settle: 100,
	}),
];

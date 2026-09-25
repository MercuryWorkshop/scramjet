import { probeTest } from "./harness.ts";

// Read-side cost of big <style> sheets (ms per read).
const mkbig = `let css=''; for(let i=0;i<3000;i++) css+='.b'+i+'{background-image:url(/img/b'+i+'.png);color:red;margin:1px 2px 3px 4px}\\n'; const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);`;
const time = (body: string, n: number) =>
	`const ts=[]; for(let rep=0;rep<3;rep++){ const t=performance.now(); for(let i=0;i<${n};i++){ ${body} } ts.push((performance.now()-t)/${n}); } return Math.round(Math.min(...ts)*100)/100;`;
const probes: Record<string, string> = {
	big_write: `const t=performance.now(); ${mkbig} return Math.round(performance.now()-t);`,
	big_textContent: `${mkbig} let x=0; ${time(`x+=s.textContent.length;`, 10)}`,
	big_innerHTML: `${mkbig} let x=0; ${time(`x+=s.innerHTML.length;`, 10)}`,
	big_head_textContent: `${mkbig} let x=0; ${time(`x+=document.head.textContent.length;`, 5)}`,
	big_head_innerHTML: `${mkbig} let x=0; ${time(`x+=document.head.innerHTML.length;`, 5)}`,
	big_firstChild_data: `${mkbig} let x=0; ${time(`x+=s.firstChild.data.length;`, 10)}`,
	big_sheet_rules: `${mkbig} let x=0; ${time(`x+=s.sheet.cssRules.length;`, 10)}`,
	big_setattr_media: `${mkbig} const t=performance.now(); for(let i=0;i<20;i++) s.media = i%2 ? 'all' : 'screen'; return Math.round(performance.now()-t);`,
	big_clone: `${mkbig} ${time(`s.cloneNode(true);`, 5)}`,
	big_move: `${mkbig} ${time(`document.head.appendChild(s);`, 5)}`,
};

export default [
	probeTest("rv18-bigstyle", probes, {
		timeout: 60000,
		settle: 100,
	}),
];

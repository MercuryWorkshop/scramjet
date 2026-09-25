import { probeTest } from "./harness.ts";

// Real CSS-in-JS / runtime CSS libraries loaded from jsdelivr, each rendering
// url() values and many rules; reports rendered result, readback and timings.
const load = (src: string) =>
	`await new Promise((res, rej) => { const s=document.createElement('script'); s.src=${JSON.stringify(src)}; s.onload=res; s.onerror=()=>rej(new Error('load '+${JSON.stringify(src)})); document.head.appendChild(s); });`;
const esm = (src: string) => `(await import(${JSON.stringify(src)}))`;
const waitFor = `const waitFor = async (fn, ms=8000) => { const t=performance.now(); while(performance.now()-t<ms){ if(fn()) return Math.round(performance.now()-t); await new Promise(r=>setTimeout(r,10)); } return 'TIMEOUT'; };`;

const probes: Record<string, string> = {
	tailwind3_cdn: `${waitFor} ${load("https://cdn.tailwindcss.com/3.4.16")}
const h=mk(); h.style.cssText='';
const t0=performance.now();
let html=''; for(let i=0;i<300;i++) html+='<div class="w-[4px] h-[4px] block mt-['+i+'px] bg-[url(/img/'+R+'-tw3.png)]"></div>';
h.innerHTML=html;
const d=h.firstChild;
const w=await waitFor(()=>getComputedStyle(h.lastChild).marginTop===(299)+'px');
const ms=Math.round(performance.now()-t0);
const styles=[...document.querySelectorAll('style')].map(s=>s.textContent).filter(t=>t.includes('tw3')).map(t=>t.match(/url\\([^)]*tw3[^)]*\\)/)[0]);
return [w, ms, getComputedStyle(d).backgroundImage.includes('tw3'), styles];`,
	tailwind3_classchurn: `${waitFor}
const h=mk(); h.style.cssText='';
let html=''; for(let i=0;i<200;i++) html+='<div class="w-[4px] h-[4px]"></div>';
h.innerHTML=html;
const t0=performance.now();
let k=0; for(const c of h.children){ c.className='w-[4px] h-[4px] ml-['+(k++)+'px]'; }
const w=await waitFor(()=>getComputedStyle(h.lastChild).marginLeft==='199px');
return [w, Math.round(performance.now()-t0)];`,
	tailwind4_browser: `${waitFor} ${load("https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.11/dist/index.global.js")}
const h=mk(); h.style.cssText='';
const t0=performance.now();
let html=''; for(let i=0;i<300;i++) html+='<div class="w-[4px] h-[4px] block pt-['+i+'px] bg-[url(/img/'+R+'-tw4.png)]"></div>';
h.innerHTML=html;
const w=await waitFor(()=>getComputedStyle(h.lastChild).paddingTop==='299px');
return [w, Math.round(performance.now()-t0), getComputedStyle(h.firstChild).backgroundImage.includes('tw4')];`,
	goober: `const g=${esm("https://cdn.jsdelivr.net/npm/goober@2.1.16/+esm")};
const t0=performance.now();
const cls=[]; for(let i=0;i<400;i++) cls.push(g.css({width:'4px', height:'4px', marginTop: i+'px', backgroundImage: 'url(/img/'+R+'-goober.png)'}));
const ms=Math.round(performance.now()-t0);
const h=mk(); h.className=cls[399]; h.style.cssText='';
const gs=document.getElementById('_goober');
return [ms, getComputedStyle(h).marginTop, gs && gs.firstChild && gs.firstChild.data.length, gs && gs.firstChild.data.includes('/~/sj/')];`,
	emotion_css: `const e=${esm("https://cdn.jsdelivr.net/npm/@emotion/css@11.13.5/+esm")};
const t0=performance.now();
const cls=[]; for(let i=0;i<400;i++) cls.push(e.css({width:'4px', height:'4px', marginTop: i+'px', backgroundImage: 'url(/img/'+R+'-emotion.png)'}));
const ms=Math.round(performance.now()-t0);
const h=mk(); h.style.cssText=''; h.className=cls[399];
return [ms, getComputedStyle(h).marginTop, getComputedStyle(h).backgroundImage.includes('emotion')];`,
	styled_components_dev: `${load("https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js")} ${load("https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js")} ${load("https://cdn.jsdelivr.net/npm/react-is@18.3.1/umd/react-is.development.js")} ${load("https://cdn.jsdelivr.net/npm/styled-components@5.3.11/dist/styled-components.js")}
const S=window.styled; const h=mk(); h.style.cssText='';
const comps=[]; for(let i=0;i<150;i++) comps.push(S.default ? S.default.div\`width:4px;height:4px;margin-top:\${i}px;background-image:url(/img/\${R}-sc.png);\` : S.div\`width:4px;height:4px;margin-top:\${i}px;background-image:url(/img/sc.png);\`);
const t0=performance.now();
const root=ReactDOM.createRoot(h);
ReactDOM.flushSync(()=>root.render(React.createElement('div',null, comps.map((C,i)=>React.createElement(C,{key:i})))));
const ms=Math.round(performance.now()-t0);
const st=[...document.querySelectorAll('style[data-styled]')];
return [ms, getComputedStyle(h.firstChild.lastChild).marginTop, st.length, st[0] && st[0].childNodes.length, st[0] && st[0].textContent.includes('/~/sj/')];`,
	lit_adopted: `const L=${esm("https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm")};
class XEl extends L.LitElement { static styles = L.css\`:host{display:block;width:4px;height:4px;background-image:url(/img/\${L.unsafeCSS(R)}-lit.png)}\`; render(){ return L.html\`<b>x</b>\`; } }
customElements.define('x-el-'+R.toLowerCase(), XEl);
const el=document.createElement('x-el-'+R.toLowerCase()); document.body.appendChild(el); await el.updateComplete;
return [el.shadowRoot.adoptedStyleSheets.length, getComputedStyle(el).backgroundImage.includes('lit')];`,
	stitches: `const st=${esm("https://cdn.jsdelivr.net/npm/@stitches/core@1.2.8/+esm")};
const {css} = st.createStitches({ media: { bp1: '(min-width: 1px)' } });
const c=css({ width:'4px', height:'4px', display:'block', '@bp1': { backgroundImage: 'url(/img/'+R+'-stitches.png)' } });
const h=mk(); h.style.cssText=''; h.className=c();
return [getComputedStyle(h).backgroundImage.includes('stitches'), getComputedStyle(h).backgroundImage.includes('/~/sj/')];`,
	framer_like_anim: `const d=mk(); d.style.backgroundImage='url(/img/'+R+'-fm.png)'; const t0=performance.now(); for(let i=0;i<600;i++){ d.style.transform='translateX('+i+'px) scale(1.0'+(i%9)+')'; d.style.opacity=String((i%10)/10); d.style.setProperty('--p', String(i)); } return Math.round(performance.now()-t0);`,
};

export default [
	probeTest("rv18-cssinjs", probes, {
		timeout: 30000,
		settle: 1500,
	}),
];

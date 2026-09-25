import { probeTest } from "./harness.ts";

// React maps the `float` style key to `style.cssFloat`, which develop's
// style wrapper doesn't treat as a CSS attribute, so the mirror goes stale.
const load = (src: string) =>
	`await new Promise((res, rej) => { const s=document.createElement('script'); s.src=${JSON.stringify(src)}; s.onload=res; s.onerror=rej; document.head.appendChild(s); });`;

const probes: Record<string, string> = {
	jquery1_float: `${load("https://cdn.jsdelivr.net/npm/jquery@1.12.4/dist/jquery.min.js")}
const h=mk(); h.style.cssText=''; h.innerHTML='<div id=jq></div>';
const $el=jQuery('#jq'); $el.css({width:'10px', 'float':'left'});
const a=[jQuery.cssProps['float'], $el.attr('style'), h.innerHTML];
jQuery.noConflict(true);
return a;`,
	react18_float: `${load("https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js")} ${load("https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js")}
const h=mk(); h.style.cssText='';
const root=ReactDOM.createRoot(h);
ReactDOM.flushSync(()=>root.render(React.createElement('div',{id:'rf', style:{width:10, height:10, float:'left'}}, 'x')));
const a=[h.innerHTML, document.getElementById('rf').getAttribute('style')];
ReactDOM.flushSync(()=>root.render(React.createElement('div',{id:'rf', style:{width:10, height:10, float:'right'}}, 'x')));
a.push(h.innerHTML);
ReactDOM.flushSync(()=>root.render(React.createElement('div',{id:'rf', style:{width:10, height:10}}, 'x')));
a.push(h.innerHTML);
ReactDOM.flushSync(()=>root.render(React.createElement('div',{id:'rf', style:{width:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}, 'x')));
a.push(h.innerHTML);
return a;`,
};

export default [
	probeTest("rv18-react-float", probes, {
		timeout: 20000,
		settle: 100,
	}),
];

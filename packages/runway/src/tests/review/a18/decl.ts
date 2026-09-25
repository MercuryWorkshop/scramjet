import { probeTest } from "./harness.ts";

// Declarations develop newly wraps in a Proxy: SVG/MathML inline style and
// every CSSRule `.style`. Calls that hand the wrapper to a native as `this`.
const probes: Record<string, string> = {
	svg_proto_setprop: `const s=mksvg(); try { CSSStyleDeclaration.prototype.setProperty.call(s.style,'fill','red'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [s.style.fill];`,
	svg_proto_gpv: `const s=mksvg(); s.style.fill='red'; try { return [CSSStyleDeclaration.prototype.getPropertyValue.call(s.style,'fill')]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	svg_proto_cssText: `const s=mksvg(); s.style.fill='red'; try { return [Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'cssText').get.call(s.style)]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	svg_proto_length: `const s=mksvg(); s.style.fill='red'; try { return [Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,'length').get.call(s.style)]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	svg_reflect_apply: `const s=mksvg(); try { Reflect.apply(CSSStyleDeclaration.prototype.setProperty, s.style, ['stroke','blue']); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [s.style.stroke];`,
	rule_proto_setprop: `const sh=inl(); sh.insertRule('.q{}'); const r=sh.cssRules[0]; try { CSSStyleDeclaration.prototype.setProperty.call(r.style,'color','red'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [r.cssText];`,
	rule_proto_gpv: `const sh=inl(); sh.insertRule('.q{color:red}'); const r=sh.cssRules[0]; try { return [CSSStyleDeclaration.prototype.getPropertyValue.call(r.style,'color')]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	rule_proto_item: `const sh=inl(); sh.insertRule('.q{color:red}'); const r=sh.cssRules[0]; try { return [CSSStyleDeclaration.prototype.item.call(r.style,0)]; } catch(e){ return 'THROW '+e.name+' '+e.message; }`,
	uncurry_setprop: `const setProp = Function.prototype.call.bind(CSSStyleDeclaration.prototype.setProperty); const s=mksvg(); try { setProp(s.style, 'fill', 'green'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [s.style.fill];`,
	cross_realm_proto: `const f=document.createElement('iframe'); document.body.appendChild(f); const d=mk(); try { f.contentWindow.CSSStyleDeclaration.prototype.setProperty.call(d.style,'color','red'); } catch(e){ return 'THROW '+e.name+' '+e.message; } return [d.style.color];`,
	svg_method_identity: `const s=mksvg(); const t=mksvg(); return [s.style.setProperty===t.style.setProperty, s.style.setProperty===CSSStyleDeclaration.prototype.setProperty, typeof s.style.setProperty, s.style.setProperty.name, String(s.style.setProperty)];`,
	svg_method_this: `const s=mksvg(); const t=mksvg(); s.style.setProperty.call(t.style, 'fill', 'red'); return [s.style.fill, t.style.fill];`,
	rule_method_this: `const sh=inl(); sh.insertRule('.a1{}'); sh.insertRule('.a2{}'); const a=sh.cssRules[0], b=sh.cssRules[1]; const sp=a.style.setProperty; sp.call(b.style,'color','red'); return [a.cssText, b.cssText];`,
	decl_constructor: `const s=mksvg(); return [s.style.constructor===CSSStyleDeclaration || s.style.constructor===window.CSSStyleProperties, s.style.constructor.name];`,
	weakmap_svg: `const s=mksvg(); const wm=new WeakMap([[s.style,1]]); return [wm.get(s.style)];`,
	// keyframes / page / nested
	keyframe_rule: `const s=document.createElement('style'); s.textContent='@keyframes kk{from{background-image:url(img/'+R+'-kf1.png)} to{color:red}}'; document.head.appendChild(s); const k=s.sheet.cssRules[0].cssRules[0]; const v=k.style.backgroundImage; k.style.backgroundImage='url(img/'+R+'-kf2.png)'; return [v, k.style.backgroundImage, k.keyText, s.sheet.cssRules[0].cssRules[1].style.color];`,
	keyframes_findRule: `const s=document.createElement('style'); s.textContent='@keyframes kk2{from{color:red} to{color:blue}}'; document.head.appendChild(s); const K=s.sheet.cssRules[0]; return [K.findRule('to').style.color, K.cssRules.length, K.name];`,
	page_rule: `const s=document.createElement('style'); s.textContent='@page { margin: 1cm; }'; document.head.appendChild(s); const p=s.sheet.cssRules[0]; return [p.style && p.style.margin, p.selectorText];`,
	nested_decls: `const s=document.createElement('style'); s.textContent='.nd{ color:red; &:hover{color:blue} background-image:url(img/'+R+'-nd.png) }'; document.head.appendChild(s); const r=s.sheet.cssRules[0]; return [r.cssRules.length, r.cssRules[1] && r.cssRules[1].constructor.name, r.cssRules[1] && r.cssRules[1].style && r.cssRules[1].style.backgroundImage];`,
	nested_style_rule: `const s=document.createElement('style'); s.textContent='.ns{ & .c{ background-image:url(img/'+R+'-ns.png) } }'; document.head.appendChild(s); const r=s.sheet.cssRules[0].cssRules[0]; return [r.selectorText, r.style.backgroundImage];`,
	fontface_desc_names: `const s=document.createElement('style'); s.textContent='@font-face{font-family:Q; src:url(/q.woff2); font-display:swap}'; document.head.appendChild(s); const st=s.sheet.cssRules[0].style; return [st.fontFamily, st.src, st.fontDisplay, st.getPropertyValue('font-display'), st.length];`,
	fontface_desc_write: `const s=document.createElement('style'); s.textContent='@font-face{font-family:Q2; src:url(/q.woff2)}'; document.head.appendChild(s); const st=s.sheet.cssRules[0].style; st.fontDisplay='block'; try{ st.src='url(/img/'+R+'-ffw.woff2)'; }catch(e){} return [s.sheet.cssRules[0].cssText];`,
	// custom properties via direct assignment
	custom_prop_assign: `const d=mk(); d.style['--x']='url(/img/'+R+'-cpa.png)'; return [d.style.getPropertyValue('--x'), d.getAttribute('style')];`,
	// inline style reads on mixed-content
	style_attr_parser_read: `const h=mk(); h.innerHTML='<div style="background-image:url(img/'+R+'-par.png); color: red"></div>'; const d=h.firstChild; return [d.style.backgroundImage, d.style.getPropertyValue('background-image'), d.style.cssText, d.getAttribute('style')];`,
	// getComputedStyle declaration is not wrapped, but getPropertyValue is intercepted
	computed_gpv_frag: `const s=mksvg(); s.style.fill='url(#nope) red'; return [getComputedStyle(s).getPropertyValue('fill'), getComputedStyle(s).fill];`,
	// perf probes (ms)
	perf_read_transform: `const d=mk(); d.style.transform='translateX(1px)'; const t=performance.now(); let x=0; for(let i=0;i<50000;i++){ x+=d.style.transform.length; } return Math.round(performance.now()-t);`,
	perf_read_svg: `const s=mksvg(); s.style.fill='red'; const t=performance.now(); let x=0; for(let i=0;i<50000;i++){ x+=s.style.fill.length; } return Math.round(performance.now()-t);`,
	perf_write_svg: `const s=mksvg(); const t=performance.now(); for(let i=0;i<20000;i++){ s.style.opacity=String((i%10)/10); } return Math.round(performance.now()-t);`,
	perf_write_svg_setprop: `const s=mksvg(); const t=performance.now(); for(let i=0;i<20000;i++){ s.style.setProperty('opacity', String((i%10)/10)); } return Math.round(performance.now()-t);`,
	perf_rule_write: `const sh=inl(); sh.insertRule('.pr{}'); const r=sh.cssRules[0]; const t=performance.now(); for(let i=0;i<20000;i++){ r.style.width=(i%100)+'px'; } return Math.round(performance.now()-t);`,
	perf_rule_get: `const sh=inl(); for(let i=0;i<200;i++) sh.insertRule('.pg'+i+'{color:red}'); const t=performance.now(); let n=0; for(let j=0;j<50;j++) for(const r of sh.cssRules){ n+=r.style.color.length; } return Math.round(performance.now()-t);`,
	perf_style_getter: `const d=mk(); const t=performance.now(); let n=0; for(let i=0;i<100000;i++){ if(d.style) n++; } return Math.round(performance.now()-t);`,
	perf_read_bg_url: `const d=mk(); d.style.backgroundImage='url(/img/'+R+'-pbu.png)'; const t=performance.now(); let n=0; for(let i=0;i<20000;i++){ n+=d.style.backgroundImage.length; } return Math.round(performance.now()-t);`,
	perf_d3_like: `const g=mksvg(); const els=[]; for(let i=0;i<500;i++){ const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); g.appendChild(c); els.push(c); } const t=performance.now(); for(let k=0;k<20;k++) for(const c of els){ c.style.setProperty('fill', k%2?'red':'blue'); c.style.setProperty('opacity', '0.5'); } return Math.round(performance.now()-t);`,
};

export default [
	probeTest("rv18-decl", probes, {
		timeout: 15000,
	}),
];

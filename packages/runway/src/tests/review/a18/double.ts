import { probeTest } from "./harness.ts";

// Values that come back from the engine already proxied (computed style,
// typed OM) and are written back: main left SVG/rule styles native, so an
// already-proxied URL loaded; develop rewrites it again.
const probes: Record<string, string> = {
	html_copy_computed_prop: `const a=mk(); a.style.backgroundImage='url(/img/'+R+'-dc_html.png)'; const b=mk(); b.style.backgroundImage=getComputedStyle(a).backgroundImage; await new Promise(r=>setTimeout(r,300)); return [b.style.backgroundImage.slice(0,80)];`,
	html_copy_computed_gpv: `const a=mk(); a.style.backgroundImage='url(/img/'+R+'-dc_html_gpv.png)'; const b=mk(); b.style.setProperty('background-image', getComputedStyle(a).getPropertyValue('background-image')); return [b.style.backgroundImage];`,
	svg_copy_computed_prop: `const a=mksvg(); a.style.backgroundImage='url(/img/'+R+'-dc_svg_src.png)'; const b=mksvg(); const src=mk(); src.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-dc_svg.png)'); b.style.backgroundImage=getComputedStyle(src).backgroundImage; return [b.style.backgroundImage.slice(0,80)];`,
	rule_copy_computed_prop: `const src=mk(); src.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-dc_rule.png)'); const sh=inl(); sh.insertRule('.dcr{}'); sh.cssRules[0].style.backgroundImage=getComputedStyle(src).backgroundImage; mk().className='dcr'; return [sh.cssRules[0].style.backgroundImage.slice(0,80)];`,
	svg_copy_from_rule_raw: `const src=mk(); src.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-dc_svg2.png)'); const v=src.attributeStyleMap.get('background-image').toString(); const b=mksvg(); b.style.backgroundImage=v; return [b.style.backgroundImage.slice(0,80)];`,
	html_copy_typed_tostring: `const src=mk(); src.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-dc_typed.png)'); const v=String(src.computedStyleMap().get('background-image')); const b=mk(); b.style.backgroundImage=v; return [v.includes('/~/sj/'), b.style.backgroundImage.slice(0,80)];`,
	svg_filter_copy: `const src=mk(); src.setAttribute('style','width:4px;height:4px;filter:url(/img/'+R+'-dc_filter.svg#f)'); const b=mksvg(); b.style.filter=getComputedStyle(src).filter; return [b.style.filter.slice(0,80)];`,
	rewrite_proxied_direct: `const a=mk(); a.style.backgroundImage='url(/img/'+R+'-x.png)'; const px=getComputedStyle(a).backgroundImage; const d=mk(); d.style.cssText='width:4px;height:4px;background-image:'+px.replace('-x.png','-dc_cssText.png'); return [d.style.backgroundImage.slice(0,80)];`,
	sheet_from_computed: `const src=mk(); src.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-dc_sheet.png)'); const v=getComputedStyle(src).backgroundImage; const sh=inl(); sh.insertRule('.dcs{background-image:'+v+'}'); mk().className='dcs'; return [sh.cssRules[0].cssText.slice(0,80)];`,
};

export default [probeTest("rv18-double", probes)];

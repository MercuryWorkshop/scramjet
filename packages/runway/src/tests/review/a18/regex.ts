import { probeTest } from "./harness.ts";

// Non-URL CSS the url() regex rewrites anyway.
const probes: Record<string, string> = {
	namespace_default: `const s=document.createElement('style'); s.textContent='@namespace url(http://www.w3.org/1999/xhtml); div.nsd{color:rgb(1,2,3)}'; document.head.appendChild(s); const d=mk(); d.className='nsd'; return [getComputedStyle(d).color, s.sheet.cssRules[0].cssText];`,
	namespace_prefix: `const s=document.createElement('style'); s.textContent='@namespace svg url(http://www.w3.org/2000/svg); svg|svg.nsp{fill:rgb(4,5,6)}'; document.head.appendChild(s); const g=mksvg(); g.setAttribute('class','nsp'); return [getComputedStyle(g).fill];`,
	namespace_insertRule: `const sh=inl(); sh.insertRule('@namespace url(http://www.w3.org/1999/xhtml)'); return [sh.cssRules[0].cssText, sh.cssRules[0].namespaceURI];`,
	namespace_ext: `const l=document.createElement('link'); l.rel='stylesheet'; l.href='/ns.css'; document.head.appendChild(l); await new Promise(r=>{l.onload=r; l.onerror=r;}); const d=mk(); d.className='nse'; return [getComputedStyle(d).color];`,
	content_quote_url: `const s=document.createElement('style'); s.textContent='.cq::before{content:"url(" } .cq2{background-image:url(/img/'+R+'-cq2.png)}'; document.head.appendChild(s); mk().className='cq2'; return [s.sheet.cssRules.length, s.sheet.cssRules[1] && s.sheet.cssRules[1].cssText];`,
	comment_apostrophe: `const s=document.createElement('style'); s.textContent="/* it's url(nothing) */ .ca{background-image:url('/img/'+R+'-ca.png')}".replace("'+R+'", R); document.head.appendChild(s); mk().className='ca'; return [s.sheet.cssRules[0].cssText];`,
	attr_selector_url: `const s=document.createElement('style'); s.textContent='a[href="url(x)"]{color:red} .asu{color:blue}'; document.head.appendChild(s); return [s.sheet.cssRules[0].selectorText];`,
	src_format_url: `const d=mk(); d.style.fontFamily='"url(x)"'; return [d.style.fontFamily];`,
	grid_area_name: `const d=mk(); d.style.gridTemplateAreas='"url url"'; return [d.style.gridTemplateAreas];`,
	counter_url: `const d=mk(); d.style.counterReset='url 1'; d.style.animationName='url'; return [d.style.counterReset, d.style.animationName];`,
	escaped_paren_unquoted: `const d=mk(); d.style.backgroundImage='url(/img/'+R+'-ep\\\\(1\\\\).png)'; return [d.style.backgroundImage];`,
	space_in_quoted: `const d=mk(); d.style.backgroundImage='url(" /img/'+R+'-sp.png ")'; return [d.style.backgroundImage];`,
	newline_url: `const d=mk(); d.style.cssText='background-image:url(\\n/img/'+R+'-nl.png\\n)'; return [d.style.backgroundImage];`,
};

export default [probeTest("rv18-regex", probes)];

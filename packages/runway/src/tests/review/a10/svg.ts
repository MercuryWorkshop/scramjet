import { probeTest } from "./lib.ts";

const X = "http://www.w3.org/1999/xlink";
const S = "http://www.w3.org/2000/svg";
const head = `<svg id=sprite style="display:none"><symbol id="ic" viewBox="0 0 10 10"><rect width=10 height=10 fill=red /></symbol><linearGradient id="g1"><stop offset=0 stop-color=red /></linearGradient><linearGradient id="g2" xlink:href="#g1" /></svg>
<svg id=parsed width=10 height=10><use id=u1 xlink:href="#ic"></use><use id=u2 href="#ic"></use><use id=u3 xlink:href="/sprite.svg#ic"></use><a id=sa xlink:href="/svglink"><text>t</text></a><image id=si xlink:href="/img.png" /></svg>`;

const probes: Record<string, string> = {
	parsed_u1: `const u=document.getElementById('u1'); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.href.animVal, u.attributes.length, u.getAttributeNames()];`,
	parsed_u2: `const u=document.getElementById('u2'); return [u.getAttribute('href'), u.href.baseVal, u.getAttributeNames()];`,
	parsed_u3: `const u=document.getElementById('u3'); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getAttributeNames()];`,
	parsed_sa: `const a=document.getElementById('sa'); return [a.getAttribute('xlink:href'), a.getAttributeNS('${X}','href'), a.href.baseVal];`,
	parsed_si: `const a=document.getElementById('si'); return [a.getAttribute('xlink:href'), a.getAttributeNS('${X}','href'), a.href.baseVal];`,
	parsed_outer: `return document.getElementById('parsed').outerHTML.replace(/localhost:\\d+/g,'L');`,
	parsed_render: `const u=document.getElementById('u1'); const r=u.getBBox(); return [r.width, r.height];`,
	grad_g2: `const g=document.getElementById('g2'); return [g.getAttribute('xlink:href'), g.href.baseVal];`,
	dyn_setNS: `const svg=document.createElementNS('${S}','svg'); const u=document.createElementNS('${S}','use'); u.setAttributeNS('${X}','xlink:href','#ic'); svg.appendChild(u); document.body.appendChild(svg); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getBBox().width, u.getAttributeNames(), svg.innerHTML];`,
	dyn_setNS_ext: `const svg=document.createElementNS('${S}','svg'); const u=document.createElementNS('${S}','use'); u.setAttributeNS('${X}','xlink:href','/sprite2.svg#ic'); svg.appendChild(u); document.body.appendChild(svg); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getAttributeNames(), svg.innerHTML.replace(/localhost:\\d+/g,'L')];`,
	dyn_setNS_prefixless: `const u=document.createElementNS('${S}','use'); u.setAttributeNS('${X}','href','#ic'); return [u.getAttribute('xlink:href'), u.getAttribute('href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getAttributeNames()];`,
	dyn_setAttr_colon: `const u=document.createElementNS('${S}','use'); u.setAttribute('xlink:href','#ic'); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getAttributeNames()];`,
	dyn_hrefBaseVal_set: `const u=document.createElementNS('${S}','use'); u.href.baseVal='#ic'; return [u.getAttribute('href'), u.getAttribute('xlink:href'), u.href.baseVal, u.getAttributeNames()];`,
	dyn_removeNS: `const u=document.createElementNS('${S}','use'); u.setAttributeNS('${X}','xlink:href','#ic'); u.removeAttributeNS('${X}','href'); return [u.getAttributeNames(), u.hasAttributeNS('${X}','href'), u.href.baseVal];`,
	dyn_hasNS: `const u=document.createElementNS('${S}','use'); u.setAttributeNS('${X}','xlink:href','#ic'); return [u.hasAttributeNS('${X}','href'), u.hasAttribute('xlink:href'), u.getAttributeNodeNS('${X}','href') && u.getAttributeNodeNS('${X}','href').value, u.attributes[0] && [u.attributes[0].name, u.attributes[0].namespaceURI, u.attributes[0].value]];`,
	innerhtml_use: `const d=document.createElement('div'); d.innerHTML='<svg><use xlink:href="#ic"></use></svg>'; document.body.appendChild(d); const u=d.querySelector('use'); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, u.getBBox().width, d.innerHTML];`,
	innerhtml_use_ext: `const d=document.createElement('div'); d.innerHTML='<svg><use xlink:href="/sprite3.svg#ic"></use></svg>'; const u=d.querySelector('use'); return [u.getAttribute('xlink:href'), u.getAttributeNS('${X}','href'), u.href.baseVal, d.innerHTML.replace(/localhost:\\d+/g,'L')];`,
	qs_xlink: `return [document.querySelectorAll('use[href="#ic"]').length, document.querySelectorAll('[*|href="#ic"]').length, document.querySelectorAll('use[xlink\\\\:href]').length];`,
	clone_use: `const u=document.getElementById('u1').cloneNode(true); return [u.getAttribute('xlink:href'), u.href.baseVal];`,
	setAttributeNode_ns: `const u=document.createElementNS('${S}','use'); const a=document.createAttributeNS('${X}','xlink:href'); a.value='#ic'; u.setAttributeNodeNS(a); return [u.getAttribute('xlink:href'), u.href.baseVal, a.value, u.getAttributeNames()];`,
	svg_a_click_href: `const a=document.getElementById('sa'); return [a.href.baseVal, a.target.baseVal];`,
	svg_script_href: `const svg=document.createElementNS('${S}','svg'); const s=document.createElementNS('${S}','script'); s.setAttribute('href','/svgscript.js'); const p=new Promise(r=>{s.onload=()=>r('load'); s.onerror=()=>r('error'); setTimeout(()=>r('none'),1500)}); svg.appendChild(s); document.body.appendChild(svg); return [await p, s.getAttribute('href'), s.href.baseVal, window.__loaded];`,
	svg_image_href_load: `const svg=document.createElementNS('${S}','svg'); const im=document.createElementNS('${S}','image'); const p=new Promise(r=>{im.onload=()=>r('load'); im.onerror=()=>r('error'); setTimeout(()=>r('none'),1500)}); im.setAttributeNS('${X}','xlink:href','/pic.svg'); svg.appendChild(im); document.body.appendChild(svg); return [await p, im.getAttributeNS('${X}','href'), im.href.baseVal];`,
};

export default [
	probeTest({
		name: "rv10-svg-xlink",
		head,
		probes,
		extra: (req, res) => {
			if (req.url.startsWith("/pic.svg") || req.url.startsWith("/sprite")) {
				res.writeHead(200, {
					"Content-Type": "image/svg+xml",
				});
				res.end(
					'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><symbol id="ic" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol><rect width="10" height="10"/></svg>'
				);
				return true;
			}
			return false;
		},
	}),
];

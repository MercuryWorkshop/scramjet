import { htmlTest } from "../../../testcommon.ts";

const probes: Record<string, string> = {
	link_sheet_href: `const s=[...document.styleSheets].find(s=>s.href); return s ? s.href : 'none';`,
	import_href: `const s=document.getElementById('imp').sheet; return s.cssRules[0].href;`,
	import_sheet_href: `const s=document.getElementById('imp').sheet; const r=s.cssRules[0]; return r.styleSheet ? r.styleSheet.href : 'none';`,
	grouping_insert: `const s=document.createElement('style'); s.textContent='@media all{}'; document.head.appendChild(s); const m=s.sheet.cssRules[0]; m.insertRule('.gi{background-image:url(/gi.png)}'); const d=document.createElement('div'); d.className='gi'; document.body.appendChild(d); return [getComputedStyle(d).backgroundImage.includes('/~/sj/'), m.cssRules[0].style.backgroundImage];`,
	keyframes_append: `const s=document.createElement('style'); s.textContent='@keyframes kf{}'; document.head.appendChild(s); const k=s.sheet.cssRules[0]; k.appendRule('50%{background-image:url(/kf.png)}'); return k.cssRules[0].cssText;`,
	stylevalue_tostring: `const d=document.createElement('div'); d.style.backgroundImage='url(/sv.png)'; document.body.appendChild(d); return [String(d.attributeStyleMap.get('background-image')), String(d.computedStyleMap().get('background-image'))];`,
	fontface_rule_set: `const s=document.createElement('style'); s.textContent='@font-face{font-family:Z; src:url(/a.woff2)}'; document.head.appendChild(s); const r=s.sheet.cssRules[0]; r.style.src='url(/b.woff2)'; r.style.setProperty('src','url(/c.woff2)'); return r.cssText;`,
	style_textContent_read: `return document.getElementById('st').textContent;`,
	style_innerHTML_read: `return document.getElementById('st').innerHTML;`,
	style_sheet_rule_read: `return document.getElementById('st').sheet.cssRules[0].cssText;`,
	style_attr_read: `return document.getElementById('sa').getAttribute('style');`,
	style_attr_cssText: `return document.getElementById('sa').style.cssText;`,
	style_attr_bg: `return document.getElementById('sa').style.backgroundImage;`,
	img_bg_loaded: `const d=document.getElementById('sa'); return getComputedStyle(d).backgroundImage.includes('/~/sj/');`,
	cssText_quotes_escapes: `const d=document.createElement('div'); d.style.backgroundImage='url("/a b.png")'; return [d.style.backgroundImage, d.getAttribute('style')];`,
	image_set: `const d=document.createElement('div'); d.style.backgroundImage='image-set(url(/x1.png) 1x, "/x2.png" 2x)'; document.body.appendChild(d); return [d.style.backgroundImage, getComputedStyle(d).backgroundImage];`,
	data_url: `const d=document.createElement('div'); d.style.backgroundImage='url(data:image/png;base64,iVBORw0KGgo=)'; return d.style.backgroundImage;`,
	var_url: `const d=document.createElement('div'); d.style.setProperty('--img','url(/v.png)'); d.style.backgroundImage='var(--img)'; document.body.appendChild(d); return [d.style.getPropertyValue('--img'), getComputedStyle(d).backgroundImage.includes('/~/sj/')];`,
	insertRule_import_str: `const s=document.createElement('style'); document.head.appendChild(s); s.sheet.insertRule('@import "/ii.css";'); return [s.sheet.cssRules[0].cssText, s.sheet.cssRules[0].href];`,
};

export default [
	htmlTest({
		name: "rv7-css-gaps",
		html: `<!doctype html><html><head>
<link rel="stylesheet" href="/l.css">
<style id="imp">@import url("/i.css");</style>
<style id="st">.q{background:url(/st.png)}</style>
</head><body><div id="sa" style="background-image: url(/sa.png)"></div>
<script>
runTest(async () => {
	const probes = {${Object.entries(probes)
		.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
		.join(",\n")}};
	const out = {};
	for (const [k, v] of Object.entries(probes)) {
		try { out[k] = JSON.stringify(await v()); } catch (e) { out[k] = 'THROW ' + e.name + ': ' + e.message; }
	}
	console.log('RV7PROBE ' + JSON.stringify(out));
	fail('RV7PROBE ' + JSON.stringify(out));
}, false);
</script></body></html>`,
	}),
];

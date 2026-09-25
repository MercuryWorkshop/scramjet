import { probeTest } from "./harness.ts";

// CSSOM URL writes from inside srcdoc and about:blank documents.
const inner = (
	R: string
) => `<div id=a style="width:4px;height:4px"></div><div id=b style="width:4px;height:4px"></div><img id=i><style id=s></style><script>
const a=document.getElementById('a'), b=document.getElementById('b');
a.style.backgroundImage='url(/img/'+${R}+'-sd_abs.png)';
b.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+${R}+'-sd_attr.png)');
document.getElementById('i').src='/img/'+${R}+'-sd_img.png';
document.getElementById('s').textContent='body{background-image:url(/img/'+${R}+'-sd_style.png)}';
const sh=new CSSStyleSheet(); sh.replaceSync('html{border-image-source:url(/img/'+${R}+'-sd_sheet.png)}'); document.adoptedStyleSheets=[sh];
fetch('/img/'+${R}+'-sd_fetch.png').catch(()=>{});
parent.__sd=[a.style.backgroundImage, b.style.backgroundImage, document.getElementById('i').src, document.baseURI];
</script>`;

const probes: Record<string, string> = {
	srcdoc: `const f=document.createElement('iframe'); window.__R=R; f.srcdoc=${JSON.stringify(inner("parent.__R"))}; document.body.appendChild(f); await new Promise(r=>f.onload=r); await new Promise(r=>setTimeout(r,500)); return window.__sd;`,
};

export default [
	probeTest("rv18-srcdoc", probes, {
		settle: 1500,
	}),
];

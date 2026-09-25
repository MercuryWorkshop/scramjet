import { probeTest } from "./harness.ts";

// CKEditor 4 maps the `float` style to `style.cssFloat` (cssStyleToDomStyle),
// and getData() serialises the editable's DOM, so float alignment set through
// its element API is lost from the saved HTML on develop.
const load = (src: string) =>
	`await new Promise((res, rej) => { const s=document.createElement('script'); s.src=${JSON.stringify(src)}; s.onload=res; s.onerror=()=>rej(new Error('load')); document.head.appendChild(s); });`;

const probes: Record<string, string> = {
	ck4_float: `window.CKEDITOR_BASEPATH='https://cdn.jsdelivr.net/npm/ckeditor4@4.22.1/'; ${load("https://cdn.jsdelivr.net/npm/ckeditor4@4.22.1/ckeditor.js")}
CKEDITOR.disableAutoInline = true;
const host=mk(); host.style.cssText=''; host.contentEditable='true'; host.innerHTML='<p>hello <img src="/img/'+R+'-ck.png" alt="a"></p>';
const ed=CKEDITOR.inline(host);
await new Promise(r=>ed.on('instanceReady', r));
const img=ed.editable().findOne('img');
img.setStyles({width:'20px', height:'10px', float:'left'});
const data1=ed.getData();
img.setStyle('float','right');
const data2=ed.getData();
return [CKEDITOR.tools.cssStyleToDomStyle('float'), data1, data2];`,
};

export default [
	probeTest("rv18-ckeditor4", probes, {
		timeout: 30000,
		settle: 200,
	}),
];

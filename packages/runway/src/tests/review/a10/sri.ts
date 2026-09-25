import { probeTest } from "./lib.ts";
import crypto from "node:crypto";

const js = `window.__sri=(window.__sri||0)+1; var l=location.host;`;
const css = `.sri{color:rgb(1,2,3); background:url(/bg.png)}`;
const h = (s: string) =>
	"sha384-" + crypto.createHash("sha384").update(s).digest("base64");

const load = (setup: string) =>
	`const s=document.createElement('script'); ${setup}; const p=new Promise(r=>{s.onload=()=>r('load'); s.onerror=()=>r('error'); setTimeout(()=>r('none'),2000)}); document.head.appendChild(s); return [await p, s.integrity, s.getAttribute('integrity')===${JSON.stringify(h(js))}];`;
const probes: Record<string, string> = {
	script_prop: load(
		`s.src='/sri.js?1'; s.crossOrigin='anonymous'; s.integrity=${JSON.stringify(h(js))}`
	),
	script_setattr: load(
		`s.setAttribute('integrity', ${JSON.stringify(h(js))}); s.src='/sri.js?2'`
	),
	script_prop_before_src: load(
		`s.integrity=${JSON.stringify(h(js))}; s.src='/sri.js?3'`
	),
	link_css_prop: `const l=document.createElement('link'); l.rel='stylesheet'; l.href='/sri.css'; l.integrity=${JSON.stringify(h(css))}; const p=new Promise(r=>{l.onload=()=>r('load'); l.onerror=()=>r('error'); setTimeout(()=>r('none'),2000)}); document.head.appendChild(l); return [await p, l.integrity];`,
	parsed_script: `return [window.__sriParsed||0, document.getElementById('ps').integrity];`,
	modulepreload: `const l=document.createElement('link'); l.rel='modulepreload'; l.href='/sri.mjs'; l.integrity=${JSON.stringify(h("export const x=1;"))}; const p=new Promise(r=>{l.onload=()=>r('load'); l.onerror=()=>r('error'); setTimeout(()=>r('none'),2000)}); document.head.appendChild(l); return [await p];`,
	fetch_integrity: `try { const r=await fetch('/sri.js?f', {integrity: ${JSON.stringify(h(js))}}); return [r.status, (await r.text()).length]; } catch(e) { return 'THROW '+e.message; }`,
};

export default [
	probeTest({
		name: "rv10-sri",
		head: `<script id=ps src="/sri.js?p" integrity="${h(js)}" onload="window.__sriParsed=1"></script>`,
		probes,
		extra: (req, res) => {
			if (req.url.startsWith("/sri.js")) {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
					"Access-Control-Allow-Origin": "*",
				});
				res.end(js);
				return true;
			}
			if (req.url.startsWith("/sri.css")) {
				res.writeHead(200, {
					"Content-Type": "text/css",
				});
				res.end(css);
				return true;
			}
			if (req.url.startsWith("/sri.mjs")) {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end("export const x=1;");
				return true;
			}
			return false;
		},
	}),
];

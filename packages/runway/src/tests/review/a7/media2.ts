import fs from "fs";
import { serverTest } from "../../../testcommon.ts";

const M = "/home/velzie/.cache/sjreview/scratch-a7/media/";
const red = fs.readFileSync(M + "red.png");
const video = fs.readFileSync(M + "v.webm");
const font = fs.readFileSync(M + "f.ttf");
let log: string[] = [];

const page = () => `<!doctype html><html><head><base href="/base/dir/">
<link rel="stylesheet" href="s.css">
<script src="b.js"></script>
</head><body>
<img id="bimg" src="img.png">
<video id="bvid" src="v.webm" poster="poster.png" preload="metadata" muted></video>
<svg><image id="bsim" href="sim.png" width="4" height="4"/><use href="sprite.svg#icon"/></svg>
<object data="o.svg" type="image/svg+xml" width="4" height="4"></object>
<iframe id="bif" src="frame.html" width="4" height="4"></iframe>
<a id="ba" href="link">l</a>
<div class="bgrel"></div><div style="width:4px;height:4px;background-image:url(inline.png)"></div>
<script>
runTest(async () => {
	const R = {};
	const $ = (id) => document.getElementById(id);
	await new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r));
	const ev = (el, ok, bad, ms=4000) => new Promise(r => { el.addEventListener(ok, () => r(ok), {once:true}); if (bad) el.addEventListener(bad, () => r(bad), {once:true}); setTimeout(() => r('timeout'), ms); });
	R.bimg = [$('bimg').naturalWidth, $('bimg').src.replace(location.origin,'')];
	R.ba = $('ba').href.replace(location.origin,'');
	R.baseURI = document.baseURI.replace(location.origin,'');
	// JS-created, relative to <base>
	const i = document.createElement('img'); i.src = 'js.png'; document.body.appendChild(i); await ev(i,'load','error'); R.jsimg = [i.naturalWidth, i.src.replace(location.origin,'')];
	const i2 = new Image(); i2.setAttribute('src', 'js2.png'); await ev(i2,'load','error'); R.jsimg2 = i2.naturalWidth;
	const v = document.createElement('video'); v.muted = true; const s = document.createElement('source'); s.src = 'v.webm?js'; s.type = 'video/webm'; v.appendChild(s); document.body.appendChild(v); R.jssource = [await ev(v,'loadedmetadata','error'), v.currentSrc.replace(location.origin,'')];
	const v2 = document.createElement('video'); v2.muted = true; v2.poster = 'jsposter.png'; v2.setAttribute('src', 'v.webm?attr'); R.jsvideoattr = [await ev(v2,'loadedmetadata','error'), v2.poster.replace(location.origin,'')];
	const tv = document.createElement('video'); tv.muted = true; tv.src = 'v.webm?trk'; const tr = document.createElement('track'); tr.kind = 'subtitles'; tr.default = true; tr.src = 't.vtt'; tv.appendChild(tr); document.body.appendChild(tv); await ev(tr,'load','error'); R.jstrack = [tr.readyState, tr.track.cues && tr.track.cues.length];
	const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'js.css'; R.jslink = await new Promise(r => { l.onload = () => r('load'); l.onerror = () => r('error'); document.head.appendChild(l); setTimeout(() => r('timeout'), 3000); });
	const pl = document.createElement('link'); pl.rel = 'preload'; pl.as = 'image'; pl.href = 'jspre.png'; R.jspreload = await new Promise(r => { pl.onload = () => r('load'); pl.onerror = () => r('error'); document.head.appendChild(pl); setTimeout(() => r('timeout'), 3000); });
	const sc = document.createElement('script'); sc.src = 'js.js'; R.jsscript = await new Promise(r => { sc.onload = () => r(['load', window.__jsjs]); sc.onerror = () => r('error'); document.head.appendChild(sc); setTimeout(() => r('timeout'), 3000); });
	const ms = document.createElement('script'); ms.type = 'module'; ms.src = 'm.js'; R.jsmodule = await new Promise(r => { ms.onload = () => r(['load', window.__mjs]); ms.onerror = () => r('error'); document.head.appendChild(ms); setTimeout(() => r('timeout'), 3000); });
	R.dynImport = await import('./dyn.js').then(m => m.default, e => 'REJ ' + e.message);
	const svgns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(svgns, 'svg'); const im = document.createElementNS(svgns, 'image'); im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'xl.png'); im.setAttribute('width','4'); im.setAttribute('height','4'); svg.appendChild(im); const im2 = document.createElementNS(svgns, 'image'); im2.href.baseVal = 'bv.png'; im2.setAttribute('width','4'); im2.setAttribute('height','4'); svg.appendChild(im2); const u = document.createElementNS(svgns, 'use'); u.setAttribute('href', 'sprite2.svg#icon'); svg.appendChild(u); document.body.appendChild(svg);
	R.xlink = [await ev(im,'load','error'), await ev(im2,'load','error'), im.getAttributeNS('http://www.w3.org/1999/xlink','href'), im2.href.baseVal];
	const ob = document.createElement('object'); ob.type = 'image/svg+xml'; ob.data = 'jso.svg'; document.body.appendChild(ob); R.jsobject = [ob.data.replace(location.origin,''), await ev(ob,'load','error')];
	const em = document.createElement('embed'); em.type = 'image/svg+xml'; em.src = 'jse.svg'; document.body.appendChild(em);
	const ff = new FontFace('BF', 'url(bf.ttf)'); R.fontface = await ff.load().then(() => 'loaded', e => 'REJ ' + e.name);
	R.fetchRel = await fetch('fetched.txt').then(r => [r.status, r.url.replace(location.origin,'')]);
	const x = new XMLHttpRequest(); x.open('GET', 'xhr.txt'); R.xhrRel = await new Promise(r => { x.onload = () => r([x.status, x.responseURL.replace(location.origin,'')]); x.onerror = () => r('error'); x.send(); });
	const w = new Worker('w.js'); R.worker = await new Promise(r => { w.onmessage = e => r(e.data); w.onerror = () => r('error'); setTimeout(() => r('timeout'), 3000); }); w.terminate();
	const d = document.createElement('div'); d.innerHTML = '<img src="ih.png"><a href="ihl">x</a>'; document.body.appendChild(d); await ev(d.firstChild,'load','error'); R.innerHTML = [d.firstChild.naturalWidth, d.lastChild.href.replace(location.origin,'')];
	const st = document.createElement('style'); st.textContent = '.dyn{width:4px;height:4px;background-image:url(dyn.png)} @import "imp.css";'; document.head.appendChild(st); const dd = document.createElement('div'); dd.className = 'dyn'; document.body.appendChild(dd); getComputedStyle(dd).backgroundImage;
	const sh = new CSSStyleSheet(); sh.replaceSync('.adopt{width:4px;height:4px;background-image:url(adopt.png)}'); document.adoptedStyleSheets = [sh]; const ad = document.createElement('div'); ad.className = 'adopt'; document.body.appendChild(ad); getComputedStyle(ad).backgroundImage;
	const el = document.createElement('div'); el.style.cssText = 'width:4px;height:4px;background-image:url(csstext.png)'; document.body.appendChild(el);
	const el2 = document.createElement('div'); el2.style.backgroundImage = 'url(prop.png)'; el2.style.width = el2.style.height = '4px'; document.body.appendChild(el2);
	const el3 = document.createElement('div'); el3.setAttribute('style', 'width:4px;height:4px;background-image:url(attr.png)'); document.body.appendChild(el3);
	const s2 = document.createElement('style'); document.head.appendChild(s2); s2.sheet.insertRule('.ins{width:4px;height:4px;background-image:url(insert.png)}'); const e4 = document.createElement('div'); e4.className = 'ins'; document.body.appendChild(e4);
	await new Promise(r => setTimeout(r, 1500));
	const logArr = await (await fetch('/__log')).json();
	R.log = [...new Set(logArr)].sort();
	console.log('RV7PROBE ' + JSON.stringify(Object.fromEntries(Object.entries(Object.assign({__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'}, R)).map(([k, v]) => [k, JSON.stringify(v)]))));
	fail('done');
}, false);
</script></body></html>`;

export default [
	Object.assign(
		serverTest({
			name: "rv7-media-base",
			start: async (server) => {
				server.on("request", (req, res) => {
					const u = req.url || "/";
					if (u === "/") {
						res.writeHead(302, {
							Location: "/page/deep/index.html",
						});
						res.end();
						return;
					}
					if (u === "/page/deep/index.html") {
						log = [];
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(page());
						return;
					}
					if (u === "/__log") {
						res.writeHead(200, {
							"Content-Type": "application/json",
						});
						res.end(JSON.stringify(log));
						return;
					}
					log.push(u);
					const path = u.split("?")[0];
					if (/\.png$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "image/png",
						});
						res.end(red);
					} else if (/\.webm$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "video/webm",
						});
						res.end(video);
					} else if (/\.ttf$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "font/ttf",
						});
						res.end(font);
					} else if (/\.vtt$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "text/vtt",
						});
						res.end("WEBVTT\n\n00:00.000 --> 00:02.000\nc\n");
					} else if (
						/s\.css$/.test(path) &&
						path.startsWith("/base/dir/s.css")
					) {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(
							".bgrel{width:4px;height:4px;background-image:url(sheetrel.png)} @import url(sheetimp.css);"
						);
					} else if (/\.css$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(".zz{background-image:url(nested.png)}");
					} else if (path.endsWith("w.js")) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							"fetch('wf.txt').then(r=>postMessage([r.status, location.href.replace(location.origin,'')]))"
						);
					} else if (path.endsWith("m.js")) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end("import './mdep.js'; window.__mjs = 1;");
					} else if (/\.js$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							"window.__jsjs = 1; export default 'dyn';".replace(
								/export default 'dyn';/,
								path.endsWith("dyn.js") ? "export default 'dyn';" : ""
							)
						);
					} else if (/\.svg$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "image/svg+xml",
						});
						res.end(
							'<svg xmlns="http://www.w3.org/2000/svg"><symbol id="icon" viewBox="0 0 4 4"><rect width="4" height="4"/></symbol></svg>'
						);
					} else if (/\.html$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end("<p>f</p>");
					} else {
						res.writeHead(200, {
							"Content-Type": "text/plain",
						});
						res.end("ok");
					}
				});
			},
		}),
		{
			timeoutMs: 90000,
		}
	),
];

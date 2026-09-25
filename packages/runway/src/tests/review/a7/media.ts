import http from "http";
import crypto from "crypto";
import fs from "fs";
import type { AddressInfo } from "node:net";
import { serverTest } from "../../../testcommon.ts";

const M = "/home/velzie/.cache/sjreview/scratch-a7/media/";
const red = fs.readFileSync(M + "red.png");
const blue = fs.readFileSync(M + "blue.png");
const video = fs.readFileSync(M + "v.webm");
const audio = fs.readFileSync(M + "a.webm");
const font = fs.readFileSync(M + "f.ttf");
const okScript = "window.__intOk = 1;";
const okCss = ".intok{width:7px}";
const sri = (s: string) =>
	"sha256-" + crypto.createHash("sha256").update(s).digest("base64");

function sendMedia(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	buf: Buffer,
	type: string,
	extra: Record<string, string> = {}
) {
	const range = req.headers.range;
	if (range) {
		const m = /bytes=(\d*)-(\d*)/.exec(range)!;
		const start = m[1] ? +m[1] : 0;
		const end = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
		res.writeHead(206, {
			"Content-Type": type,
			"Content-Range": `bytes ${start}-${end}/${buf.length}`,
			"Accept-Ranges": "bytes",
			"Content-Length": end - start + 1,
			...extra,
		});
		res.end(buf.subarray(start, end + 1));
	} else {
		res.writeHead(200, {
			"Content-Type": type,
			"Accept-Ranges": "bytes",
			"Content-Length": buf.length,
			...extra,
		});
		res.end(buf);
	}
}

let log: string[] = [];
let xport = 0;

const page = () => `<!doctype html><html><head>
<link rel="preload" as="image" href="/pre.png">
<link rel="prefetch" href="/pf.txt">
<link rel="modulepreload" href="/mod.js">
<link rel="icon" href="/fav.png">
<link rel="manifest" href="/m.json">
<link rel="preload" as="font" type="font/ttf" href="/pfont.ttf" crossorigin>
<link rel="stylesheet" href="/print.css" media="print">
<link id="lsok" rel="stylesheet" href="/intok.css" integrity="${sri(okCss)}">
<link id="lsbad" rel="stylesheet" href="/intbad.css" integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=">
<link id="lsrel" rel="stylesheet" href="/css/s.css">
<script id="sok" src="/intok.js" integrity="${sri(okScript)}"></script>
<script id="sbad" src="/intbad.js" integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" onerror="window.__intBadErr=1"></script>
<style>
@font-face { font-family: F1; src: url(/f.ttf); }
@font-face { font-family: FX; src: url(http://localhost:${xport}/xf.ttf); }
@font-face { font-family: FXN; src: url(http://localhost:${xport}/xfnocors.ttf); }
.bg { width: 10px; height: 10px; background-image: url(/bg.png); }
.mask { width: 10px; height: 10px; -webkit-mask-image: url(/mask.png); mask-image: url(/mask.png); background: red; }
.li { list-style-image: url(/li.png); }
.ct::before { content: url(/content.png); }
.bi { border: 5px solid; border-image-source: url(/bi.png); border-image-slice: 1; }
.is { width: 10px; height: 10px; background-image: image-set(url(/is.png) 1x, url(/is2.png) 2x); }
.cur { cursor: url(/cur.png), auto; width: 10px; height: 10px; }
</style>
</head><body>
<img id="img1" src="/red.png" decoding="async" fetchpriority="high" referrerpolicy="no-referrer">
<picture><source id="ps" srcset="/blue.png" media="(min-width: 1px)" type="image/png"><img id="pic" src="/red.png?pic"></picture>
<picture><source srcset="/blue.png?bad" type="image/x-nope"><img id="pic2" src="/red.png?pic2"></picture>
<img id="xco" crossorigin="anonymous" src="http://localhost:${xport}/xcors.png">
<img id="xnoc" src="http://localhost:${xport}/xplain.png">
<img id="xcobad" crossorigin="anonymous" src="http://localhost:${xport}/xnocors.png">
<video id="vid" src="/v.webm" preload="auto" poster="/poster.png" muted crossorigin="anonymous"><track id="trk" kind="subtitles" src="/t.vtt" srclang="en" default></video>
<video id="vid2" preload="metadata" muted><source src="/v.webm?src" type="video/webm"></video>
<object id="obj" data="/o.svg" type="image/svg+xml" width="10" height="10"></object>
<embed id="emb" src="/e.svg" type="image/svg+xml" width="10" height="10">
<svg width="40" height="20"><image id="sim" href="/sim.png" width="10" height="10"/><use id="use" href="/sprite.svg#icon" x="20"/></svg>
<div class="bg"></div><div class="mask"></div><ul class="li"><li>x</li></ul><div class="ct"></div><div class="bi">b</div><div class="is"></div><div class="cur"></div>
<div class="rel"></div><div class="sub"></div><div class="intok" id="intokdiv"></div>
<span style="font-family:F1">ⵣ</span><span style="font-family:FX">ⵣ</span>
<a id="ping" href="/pinged" ping="/ping" target="pingframe">p</a><iframe name="pingframe" width="10" height="10"></iframe>
<a id="dl" href="/red.png" download="r.png">d</a>
<div style="height:4000px"></div>
<img id="lazy" loading="lazy" src="/lazy.png">
<iframe id="lazyif" loading="lazy" src="/lazyframe.html" width="10" height="10"></iframe>
<script>
runTest(async () => {
	const R = {};
	const ev = (el, ok, bad, ms=4000) => new Promise(r => { el.addEventListener(ok, () => r(ok), {once:true}); if (bad) el.addEventListener(bad, () => r(bad), {once:true}); setTimeout(() => r('timeout'), ms); });
	const loaded = (img) => img.complete && img.naturalWidth ? Promise.resolve('load') : ev(img, 'load', 'error');
	const $ = (id) => document.getElementById(id);
	await new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r));
	R.img1 = [await loaded($('img1')), $('img1').naturalWidth, $('img1').complete, $('img1').currentSrc.endsWith('/red.png'), $('img1').getAttribute('decoding'), $('img1').fetchPriority, $('img1').referrerPolicy];
	R.pic = [await loaded($('pic')), $('pic').naturalWidth, $('pic').currentSrc.replace(location.origin,'')];
	R.pic2 = [await loaded($('pic2')), $('pic2').naturalWidth, $('pic2').currentSrc.replace(location.origin,'')];
	const ni = new Image(); const niEv = ev(ni, 'load', 'error'); ni.src = '/newimg.png'; R.newImage = [await niEv, ni.naturalWidth, ni.complete];
	const di = new Image(); di.src = '/decode.png'; R.decode = await di.decode().then(() => ['ok', di.naturalWidth], e => 'REJ ' + e.name);
	const taint = (img) => { try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.getImageData(0,0,1,1); return 'clean'; } catch (e) { return e.name; } };
	R.xco = [await loaded($('xco')), $('xco').naturalWidth, taint($('xco'))];
	R.xnoc = [await loaded($('xnoc')), $('xnoc').naturalWidth, taint($('xnoc'))];
	R.xcobad = [await loaded($('xcobad')), $('xcobad').naturalWidth];
	const v = $('vid');
	if (v.readyState < 1) await ev(v, 'loadedmetadata', 'error');
	R.vid = [v.readyState >= 1, Math.round(v.duration), v.videoWidth, v.error && v.error.code, v.getAttribute('poster'), v.poster.replace(location.origin,'')];
	v.currentTime = 3; R.seek = [await ev(v, 'seeked', 'error'), Math.round(v.currentTime)];
	R.play = await v.play().then(() => 'played', e => 'REJ ' + e.name); v.pause();
	const t = $('trk'); if (t.readyState < 2) await ev(t, 'load', 'error');
	R.track = [t.readyState, t.track.cues ? t.track.cues.length : -1, t.track.cues && t.track.cues[0] && t.track.cues[0].text];
	const v2 = $('vid2'); if (v2.readyState < 1) await ev(v2, 'loadedmetadata', 'error'); R.vid2 = [v2.readyState >= 1, v2.currentSrc.replace(location.origin,'')];
	const a = new Audio('/a.webm'); R.audio = [await ev(a, 'loadedmetadata', 'error'), Math.round(a.duration), a.canPlayType('audio/webm; codecs=opus'), document.createElement('video').canPlayType('video/webm')];
	const vb = document.createElement('video'); vb.muted = true; const blob = await (await fetch('/v.webm?blob')).blob(); vb.src = URL.createObjectURL(blob); R.blobVideo = [await ev(vb, 'loadedmetadata', 'error'), Math.round(vb.duration), vb.error && vb.error.code];
	if (self.MediaSource && MediaSource.isTypeSupported('video/webm; codecs="vp8,opus"')) {
		const ms = new MediaSource(); const vm = document.createElement('video'); vm.muted = true; vm.src = URL.createObjectURL(ms);
		R.mse = await new Promise(r => { ms.addEventListener('sourceopen', async () => { try { const sb = ms.addSourceBuffer('video/webm; codecs="vp8,opus"'); const buf = await (await fetch('/v.webm?mse')).arrayBuffer(); sb.addEventListener('updateend', () => { try { ms.endOfStream(); r(['ok', Math.round(ms.duration)]); } catch (e) { r(['state', ms.readyState, vm.error && vm.error.code]); } }, {once:true}); sb.appendBuffer(buf); } catch (e) { r('ERR ' + e); } }); setTimeout(() => r('timeout'), 4000); });
	} else R.mse = 'unsupported';
	R.fontsLoad = await document.fonts.load('16px F1').then(f => f.length, e => 'REJ ' + e);
	R.fontCheck = document.fonts.check('16px F1');
	const ff = new FontFace('F2', 'url(/f.ttf?api)'); R.fontFace = await ff.load().then(() => ff.status, e => 'REJ ' + e.name);
	R.fontX = await document.fonts.load('16px FX').then(f => f.length, e => 'REJ ' + e);
	R.fontXN = await document.fonts.load('16px FXN').then(f => f.length, e => 'REJ ' + e);
	R.integrity = [window.__intOk, window.__intBadRan, window.__intBadErr, getComputedStyle($('intokdiv')).width, !!$('lsok').sheet, $('lsok').getAttribute('integrity') === ${JSON.stringify(sri(okCss))}, $('sok').integrity === ${JSON.stringify(sri(okScript))}];
	R.obj = [!!$('obj').contentDocument, $('obj').contentDocument && $('obj').contentDocument.documentElement && $('obj').contentDocument.documentElement.localName];
	R.sim = [$('sim').getAttribute('href'), $('sim').href.baseVal];
	R.use = [$('use').getAttribute('href'), $('use').getBBox().width > 0];
	R.bgComputed = getComputedStyle(document.querySelector('.bg')).backgroundImage.replace(location.origin, '');
	$('ping').click();
	R.download = [$('dl').download, $('dl').getAttribute('download')];
	await new Promise(r => setTimeout(r, 600));
	const before = await (await fetch('/__log')).json();
	R.lazyBefore = before.filter(x => /lazy/.test(x));
	$('lazy').scrollIntoView(); $('lazyif').scrollIntoView();
	R.lazy = [await loaded($('lazy')), $('lazy').naturalWidth];
	await new Promise(r => setTimeout(r, 1200));
	const logArr = await (await fetch('/__log')).json();
	R.lazyAfter = logArr.filter(x => /lazy/.test(x));
	R.log = [...new Set(logArr)].sort();
	console.log('RV7PROBE ' + JSON.stringify(Object.fromEntries(Object.entries(Object.assign({__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'}, R)).map(([k, v]) => [k, JSON.stringify(v)]))));
	fail('done');
}, false);
</script></body></html>`;

const vtt = "WEBVTT\n\n00:00.000 --> 00:03.000\nhello cue\n";

export default [
	Object.assign(
		serverTest({
			name: "rv7-media-loading",
			start: async (server) => {
				const xs = http.createServer((req, res) => {
					log.push("X " + req.method + " " + req.url);
					const cors = {
						"Access-Control-Allow-Origin": "*",
					};
					if (req.url === "/xcors.png") {
						res.writeHead(200, {
							"Content-Type": "image/png",
							...cors,
						});
						res.end(blue);
					} else if (req.url === "/xplain.png" || req.url === "/xnocors.png") {
						res.writeHead(200, {
							"Content-Type": "image/png",
						});
						res.end(blue);
					} else if (req.url === "/xf.ttf") {
						res.writeHead(200, {
							"Content-Type": "font/ttf",
							...cors,
						});
						res.end(font);
					} else if (req.url === "/xfnocors.ttf") {
						res.writeHead(200, {
							"Content-Type": "font/ttf",
						});
						res.end(font);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
				await new Promise<void>((r) => xs.listen(0, () => r()));
				xport = (xs.address() as AddressInfo).port;
				server.on("close", () => xs.close());
				server.on("request", (req, res) => {
					const u = req.url || "/";
					if (u === "/") {
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
						res.end(JSON.stringify(log.filter((x) => !/__log/.test(x))));
						return;
					}
					log.push(
						req.method + " " + u + (req.headers.range ? " [range]" : "")
					);
					const path = u.split("?")[0];
					if (/\.png$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "image/png",
						});
						res.end(/blue/.test(path) ? blue : red);
					} else if (path === "/v.webm")
						sendMedia(req, res, video, "video/webm");
					else if (path === "/a.webm") sendMedia(req, res, audio, "audio/webm");
					else if (/\.ttf$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "font/ttf",
						});
						res.end(font);
					} else if (path === "/t.vtt") {
						res.writeHead(200, {
							"Content-Type": "text/vtt",
						});
						res.end(vtt);
					} else if (path === "/intok.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(okScript);
					} else if (path === "/intbad.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end("window.__intBadRan = 1;");
					} else if (path === "/intok.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(okCss);
					} else if (path === "/intbad.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(".intok{width:99px}");
					} else if (path === "/css/s.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(
							'@import "sub.css";\n.rel{width:10px;height:10px;background-image:url(img/rel.png)}'
						);
					} else if (path === "/css/sub.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(
							".sub{width:10px;height:10px;background-image:url(../subrel.png)}"
						);
					} else if (/\.css$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end("x{}");
					} else if (/\.svg$/.test(path)) {
						res.writeHead(200, {
							"Content-Type": "image/svg+xml",
						});
						res.end(
							'<svg xmlns="http://www.w3.org/2000/svg"><symbol id="icon" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol><rect width="5" height="5"/></svg>'
						);
					} else if (path === "/mod.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end("export default 1");
					} else if (path === "/m.json") {
						res.writeHead(200, {
							"Content-Type": "application/manifest+json",
						});
						res.end(
							'{"name":"x","icons":[{"src":"/micon.png","sizes":"4x4"}]}'
						);
					} else if (/\.html$/.test(path) || path === "/pinged") {
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

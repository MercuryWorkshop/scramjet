import { serverTest } from "../../../testcommon.ts";
import fs from "node:fs";

const LIBDIR = "/home/velzie/.cache/sjreview/scratch-a11/libs/";
const lib = (n: string) => fs.readFileSync(LIBDIR + n, "utf8");

// multi-page app test: pages keyed by path, probe runs in "/" page only
function appTest(props: {
	name: string;
	pages: Record<
		string,
		| string
		| ((req: any) => {
				status?: number;
				headers?: any;
				body: string;
		  })
	>;
	probe: string; // body of async fn; must return a JSON-able value
	timeout?: number;
}) {
	return serverTest({
		name: props.name,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (path === "/__probe.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`runTest(async () => {
						window.addEventListener('beforeunload', () => { console.log('RV11PROBE ' + JSON.stringify({${JSON.stringify(props.name)}: 'FULL RELOAD/UNLOAD'})); });
						const wait = (ms) => new Promise(r => setTimeout(r, ms));
						const until = async (f, ms=4000) => { const t=Date.now(); while(Date.now()-t<ms){ try { if (await f()) return true; } catch(e){} await wait(50);} return false; };
						let res;
						try { res = await (async () => {${props.probe}\n})(); } catch (e) { res = 'THROW ' + e + ' ' + (e && e.stack); }
						console.log('RV11PROBE ' + JSON.stringify({${JSON.stringify(props.name)}: res}));
						fail('RV11PROBE ' + JSON.stringify({${JSON.stringify(props.name)}: res}));
					}, false);`);
					return;
				}
				if (path.startsWith("/lib/")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(lib(path.slice(5)));
					return;
				}
				const page = props.pages[path];
				if (page === undefined) {
					if (path.endsWith(".css")) {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end("body{color:rgb(1,2,3)}");
						return;
					}
					if (path.endsWith(".js")) {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							`window.__ext=(window.__ext||[]);window.__ext.push(${JSON.stringify(path)});`
						);
						return;
					}
					res.writeHead(404, {
						"Content-Type": "text/plain",
					});
					res.end("nf " + path);
					return;
				}
				if (typeof page === "function") {
					let body = "";
					req.on("data", (d: any) => (body += d));
					req.on("end", () => {
						req.body = body;
						const r = page(req);
						res.writeHead(
							r.status ?? 200,
							r.headers ?? {
								"Content-Type": "text/html",
							}
						);
						res.end(r.body);
					});
					return;
				}
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(page);
			});
		},
	});
}

const turboHead = `<meta charset=utf-8><script src="/lib/turbo.js"></script><link rel="stylesheet" href="/app.css" data-turbo-track="reload"><script src="/app.js" data-turbo-track="reload"></script><meta name="csrf-token" content="tok123">`;

export default [
	appTest({
		name: "rv11-lib-turbo-drive",
		pages: {
			"/": `<!doctype html><html><head>${turboHead}<title>one</title></head><body><a id=l href="/page2">p2</a><div id=c1>one</div><script>window.p1inline=(window.p1inline||0)+1</script><script src="/__probe.js"></script></body></html>`,
			"/page2": `<!doctype html><html><head>${turboHead}<title>two</title><style>#h2{color:rgb(9,8,7)}</style></head><body><h1 id=h2>two</h1><a id=back href="/">back</a><a id=rel href="sub/x">rel</a><img id=im src="/img.png"><script>window.p2inline=(window.p2inline||0)+1</script><script src="/p2ext.js"></script><form id=f action="/post" method=post><input name=a value=1></form></body></html>`,
			"/post": (req) =>
				req.method === "POST"
					? {
							status: 303,
							headers: {
								Location: "/done?b=" + encodeURIComponent(req.body),
							},
							body: "",
						}
					: {
							body: "get",
						},
			"/done": `<!doctype html><html><head>${turboHead}<title>done</title></head><body><p id=done>done</p></body></html>`,
		},
		probe: `
			const out = {};
			let loads = 0; document.addEventListener('turbo:load', () => loads++);
			out.turbo = typeof Turbo;
			await wait(300);
			document.getElementById('l').click();
			out.nav = await until(() => document.getElementById('h2'));
			await wait(300);
			out.path = location.pathname; out.title = document.title;
			out.p1inline = window.p1inline; out.p2inline = window.p2inline; out.ext = window.__ext;
			out.headScripts = document.head.querySelectorAll('script').length;
			out.headLinks = document.head.querySelectorAll('link').length;
			out.h2color = getComputedStyle(document.getElementById('h2')).color;
			out.relHref = document.getElementById('rel') && document.getElementById('rel').href;
			out.imgSrc = document.getElementById('im') && document.getElementById('im').src;
			out.csrf = document.querySelector('meta[name=csrf-token]') && document.querySelector('meta[name=csrf-token]').content;
			// form submit via turbo
			document.getElementById('f').requestSubmit();
			out.formNav = await until(() => document.getElementById('done'));
			out.formPath = location.pathname + location.search;
			// back
			history.back();
			out.back = await until(() => document.getElementById('h2'));
			out.backPath = location.pathname;
			history.back();
			out.back2 = await until(() => document.getElementById('c1'));
			out.back2Path = location.pathname;
			out.loads = loads;
			return out;`,
	}),
	appTest({
		name: "rv11-lib-turbo-frame",
		pages: {
			"/": `<!doctype html><html><head>${turboHead}</head><body><turbo-frame id=f1 src="/frame1"></turbo-frame><turbo-frame id=f2><a id=fl href="/frame2">go</a></turbo-frame><script src="/__probe.js"></script></body></html>`,
			"/frame1": `<!doctype html><html><head></head><body><turbo-frame id=f1><p id=fc1>lazy <a href="/x">x</a></p><script>window.f1s=(window.f1s||0)+1</script></turbo-frame></body></html>`,
			"/frame2": `<!doctype html><html><head></head><body><turbo-frame id=f2><p id=fc2>two</p><img src="/i2.png"></turbo-frame></body></html>`,
		},
		probe: `
			const out = {};
			out.lazy = await until(() => document.getElementById('fc1'));
			out.f1s = window.f1s;
			document.getElementById('fl').click();
			out.f2 = await until(() => document.getElementById('fc2'));
			out.path = location.pathname;
			out.f2html = document.getElementById('f2').innerHTML;
			out.f1html = document.getElementById('f1').innerHTML;
			out.f1src = document.getElementById('f1').getAttribute('src') + ' | ' + document.getElementById('f1').src;
			return out;`,
	}),
	appTest({
		name: "rv11-lib-htmx",
		pages: {
			"/": `<!doctype html><html><head><script src="/lib/htmx.js"></script></head><body>
				<button id=b hx-get="/frag" hx-target="#t" hx-swap="innerHTML">go</button><div id=t></div>
				<div id=oob></div>
				<button id=b2 hx-post="/echo" hx-vals='{"k":"v"}' hx-target="#t2">post</button><div id=t2></div>
				<a id=boost hx-boost="true" href="/boosted">boost</a>
				<div hx-get="/onload" hx-trigger="load" id=ld></div>
				<button id=b3 hx-get="/frag3" hx-on::after-request="window.afterReq=(window.afterReq||0)+1" hx-target="#t3">x</button><div id=t3></div>
				<script src="/__probe.js"></script></body></html>`,
			"/frag": `<p id=fp>frag <a id=fa href="rel/y">y</a><img id=fi src="/fi.png"></p><script>window.hxran=(window.hxran||0)+1</script><div id=oob hx-swap-oob="true">oob!</div>`,
			"/echo": (req) => ({
				headers: {
					"Content-Type": "text/html",
				},
				body: `<span id=echo>${req.method} ${req.body}</span>`,
			}),
			"/boosted": `<!doctype html><html><head><title>boosted</title></head><body><p id=bp>boosted body</p><script>window.bran=(window.bran||0)+1</script></body></html>`,
			"/onload": `<i id=onl>loaded</i>`,
			"/frag3": `<b id=f3>3</b>`,
		},
		probe: `
			const out = {};
			out.htmx = typeof htmx;
			out.onload = await until(() => document.getElementById('onl'));
			document.getElementById('b').click();
			out.swap = await until(() => document.getElementById('fp'));
			await wait(200);
			out.hxran = window.hxran; out.oob = document.getElementById('oob') && document.getElementById('oob').textContent;
			out.fa = document.getElementById('fa') && [document.getElementById('fa').getAttribute('href'), document.getElementById('fa').href];
			document.getElementById('b2').click();
			out.echo = await until(() => document.getElementById('echo'));
			out.echoText = document.getElementById('echo') && document.getElementById('echo').textContent;
			document.getElementById('b3').click();
			out.f3 = await until(() => document.getElementById('f3'));
			await wait(100);
			out.afterReq = window.afterReq;
			document.getElementById('boost').click();
			out.boost = await until(() => document.getElementById('bp'));
			await wait(200);
			out.bran = window.bran; out.bpath = location.pathname; out.btitle = document.title;
			return out;`,
	}),
	appTest({
		name: "rv11-lib-dompurify",
		pages: {
			"/": `<!doctype html><html><head><script src="/lib/purify.js"></script></head><body><script src="/__probe.js"></script></body></html>`,
		},
		probe: `
			const inputs = [
				'<b>bold</b><img src=x onerror=alert(1)>',
				'<a href="/rel/path?q=1#h" target=_blank title=t>link</a>',
				'<a href="javascript:alert(1)">js</a>',
				'<img src="/img.png" srcset="/a.png 1x, /b.png 2x" alt=a>',
				'<svg><use href="#i"/><a xlink:href="/x">s</a></svg>',
				'<div style="color:red;background:url(/bg.png)">st</div>',
				'<style>p{color:red}</style><p>p</p>',
				'<form action="/f"><input name=x formaction="/g"></form>',
				'<iframe src="/fr" srcdoc="<b>x</b>"></iframe>',
				'<table><tr><td>c</td></tr></table>',
				'<p onclick="x()">click</p><script>alert(1)</script>',
				'<math><mi href="/m">m</mi></math>',
				'<template><img src=/t.png></template>',
				'<meta http-equiv=refresh content="0;url=/r">',
				'<video poster="/p.png" src="/v.mp4"></video>',
			];
			const out = {};
			inputs.forEach((s, i) => { try { out['s'+i] = DOMPurify.sanitize(s); } catch(e) { out['s'+i] = 'THROW ' + e; } });
			try { out.frag = DOMPurify.sanitize('<a href="/q">q</a><i>i</i>', {RETURN_DOM_FRAGMENT: true}).childNodes.length; } catch(e) { out.frag = 'THROW ' + e; }
			try { const d = DOMPurify.sanitize('<a href="/q2">q</a>', {RETURN_DOM: true}); out.dom = d.innerHTML; } catch(e) { out.dom = 'THROW ' + e; }
			try { out.whole = DOMPurify.sanitize('<html><head><title>t</title></head><body><a href="/w">w</a></body></html>', {WHOLE_DOCUMENT: true}); } catch(e) { out.whole = 'THROW ' + e; }
			try { DOMPurify.addHook('afterSanitizeAttributes', n => { if (n.tagName === 'A') n.setAttribute('rel', 'noopener'); }); out.hook = DOMPurify.sanitize('<a href="/h">h</a>'); DOMPurify.removeAllHooks(); } catch(e) { out.hook = 'THROW ' + e; }
			out.removed = DOMPurify.removed.length;
			out.supported = DOMPurify.isSupported;
			return out;`,
	}),
	appTest({
		name: "rv11-lib-jquery",
		pages: {
			"/": `<!doctype html><html><head><script src="/lib/jquery.js"></script></head><body><div id=x></div><div id=y></div><div id=z></div><script src="/__probe.js"></script></body></html>`,
			"/part": `<p id=part>part <a href="p/q">pq</a></p><script>window.loadran=(window.loadran||0)+1</script>`,
		},
		probe: `
			const out = {};
			$('#x').html('<script>window.jq1=(window.jq1||0)+1<\\/script><b id=jb>x</b>');
			out.jq1 = window.jq1;
			$('#y').append($('<div>').append('<script>window.jq2=(window.jq2||0)+1<\\/script>'));
			out.jq2 = window.jq2;
			$('<script>window.jq3=(window.jq3||0)+1<\\/script>').appendTo('#z');
			out.jq3 = window.jq3;
			out.parse = $.parseHTML('<a href="/pp">pp</a><script>window.jq4=1<\\/script>', document, true).map(n => n.nodeName + ':' + (n.getAttribute && (n.getAttribute('href')||n.text)));
			$('#z').append($.parseHTML('<script>window.jq4=(window.jq4||0)+1<\\/script>', document, true));
			out.jq4 = window.jq4;
			await new Promise(r => $('#y').load('/part', r));
			out.load = $('#part').length; out.loadran = window.loadran; out.loadHref = $('#part a').attr('href') + ' ' + $('#part a').prop('href');
			out.wrap = $('<div>').html('<img src="/a.png" style="background:url(/b.png)">').html();
			out.clone = $('#jb').clone().prop('outerHTML');
			out.text = $('<div>').html('<script>var a = "</sc"+"ript>";<\\/script>').text();
			return out;`,
	}),
];

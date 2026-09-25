import { serverTest } from "../../../testcommon.ts";

const PAGE = String.raw`<!doctype html><html lang=en><head>
<script>window.__early = 1;</script>
<base href="/b1/"><base href="/b2/">
<link rel=stylesheet href="dup-a.css" href="dup-b.css">
</head><body class=one>
<img id=d1 src="d1a.png" src="d1b.png">
<img id=d2 SRC="d2.png">
<img id=d3 src="  d3.png
">
<img id=d4 src="d4 .png">
<img id=d5 src="d%34.png">
<a id=a1 href="r1" HREF="r2">a</a>
<a id=a2 href=unq?x=1&y=2>a</a>
<a id=a3 href="?q=1">q</a>
<a id=a4 href="//other.example/p">pr</a>
<a id=a5 href="HTTPS://Example.COM/Path">up</a>
<a id=a6 href="http://[bad">bad</a>
<a id=a7 href="  /spaced  ">sp</a>
<a id=a8 href="tel:+1">t</a><a id=a9 href="sms:1">s</a><a id=a10 href="webcal://x/y">w</a><a id=a11 href="intent://x#Intent;end">i</a>
<body class=two data-late=1>
<div id=late><script>window.__bodyScript = document.body.className + '|' + document.body.getAttribute('data-late');</script></div>
<table><script>window.__tblScript = 1;</script><tr><td id=td>x</td></tr></table>
<form id=f action="post-me" method=post><input name=a><button id=fb formaction="alt">b</button></form>
<object id=o data="o.bin" type="application/x-nope"></object>
<video id=v poster="p.png"><source id=vs src="v.mp4"><track id=tr src="t.vtt"></video>
<script>
runTest(async () => {
	await new Promise(r => setTimeout(r, 600));
	const q = s => document.querySelector(s);
	const O = location.origin;
	const strip = s => String(s).split(O).join('O');
	const out = {};
	for (const id of ['d1','d2','d3','d4','d5']) out[id] = [q('#'+id).getAttribute('src'), strip(q('#'+id).src)];
	for (const id of ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11']) out[id] = [q('#'+id).getAttribute('href'), strip(q('#'+id).href)];
	out.baseURI = strip(document.baseURI);
	out.body = [document.body.className, document.body.getAttribute('data-late'), window.__bodyScript];
	out.tbl = window.__tblScript;
	out.form = [strip(q('#f').action), strip(q('#fb').formAction)];
	out.media = [strip(q('#v').poster), strip(q('#vs').src), strip(q('#tr').src), strip(q('#o').data)];
	out.hits = (await (await fetch('/__hits')).json());
	console.log('RV11PROBE ' + JSON.stringify({"rv11-parse-fidelity2": out}));
	fail('RV11PROBE ' + JSON.stringify({"rv11-parse-fidelity2": out}));
}, false);
</script></body></html>`;

export default [
	serverTest({
		name: "rv11-parse-fidelity2",
		start: async (server) => {
			let hits: string[] = [];
			server.on("request", (req: any, res: any) => {
				const u = req.url;
				if (u === "/" || u.startsWith("/?")) {
					hits = [];
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(PAGE);
					return;
				}
				if (u === "/__hits") {
					res.writeHead(200, {
						"Content-Type": "application/json",
					});
					res.end(JSON.stringify([...new Set(hits)].sort()));
					return;
				}
				hits.push(u);
				res.writeHead(200, {
					"Content-Type": u.endsWith(".css")
						? "text/css"
						: "application/octet-stream",
				});
				res.end("");
			});
		},
	}),
];

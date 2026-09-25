import { serverTest } from "../../../testcommon.ts";

export const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
	"base64"
);

const page = (name: string) => `<!doctype html><html><head>
<link rel="stylesheet" href="/css/ext.css" id="ext">
<style id="st1">.st1{background:url(img/st1.png)}</style>
</head><body><h1>${name}</h1>
<script src="/probe.js"></script>
</body></html>`;

const sub = `<!doctype html><html><body><div id=q style="width:4px;height:4px"></div><div id=q2 style="width:4px;height:4px"></div><script>
const R = new URLSearchParams(location.search).get('r');
if (R !== 'none') {
const q=document.getElementById('q'); q.style.backgroundImage='url(img/'+R+'-c_subframe.png)';
const q2=document.getElementById('q2'); q2.setAttribute('style','width:4px;height:4px;background-image:url(/img/'+R+'-c_subframe_attr.png)');
const s=document.createElement('style'); s.textContent='body{background-image:url(img/'+R+'-c_subframe_style.png)}'; document.head.appendChild(s);
window.__res=[q.style.backgroundImage, q2.getAttribute('style'), s.textContent];
}
</script></body></html>`;

export function probeTest(
	testName: string,
	probes: Record<string, string>,
	opts: {
		timeout?: number;
		settle?: number;
	} = {}
) {
	return serverTest({
		name: testName,
		autoPass: false,
		async start(server) {
			const log: string[] = [];
			server.on("request", (req, res) => {
				const u = req.url || "/";
				if (u !== "/__log") log.push(u);
				if (u === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(page(testName));
				} else if (u.startsWith("/sub.html")) {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(sub);
				} else if (u === "/__log") {
					res.writeHead(200, {
						"Content-Type": "application/json",
						"Cache-Control": "no-store",
					});
					res.end(JSON.stringify(log));
				} else if (u === "/css/ext.css") {
					res.writeHead(200, {
						"Content-Type": "text/css",
					});
					res.end(
						".e1{width:4px} .e2{width:4px} .e3{width:4px} .e4{background-image:url(img/e4.png)}"
					);
				} else if (u === "/ns.css") {
					res.writeHead(200, {
						"Content-Type": "text/css",
					});
					res.end(
						"@namespace url(http://www.w3.org/1999/xhtml);\n.nse{color:rgb(7,8,9)}"
					);
				} else if (u.startsWith("/css/")) {
					res.writeHead(200, {
						"Content-Type": "text/css",
					});
					res.end(".lnk{color:red}");
				} else if (u === "/probe.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`runTest(async () => {
const R = Math.random().toString(36).slice(2, 8);
const PNGBYTES = Uint8Array.from(atob(${JSON.stringify(PNG.toString("base64"))}), c => c.charCodeAt(0));
const mk = (tag='div') => { const d=document.createElement(tag); d.style.cssText='width:4px;height:4px;display:block'; document.body.appendChild(d); return d; };
const mksvg = () => { const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('width','4'); s.setAttribute('height','4'); document.body.appendChild(s); return s; };
const inl = () => { const s=document.createElement('style'); document.head.appendChild(s); return s.sheet; };
const ext = () => document.getElementById('ext').sheet;
const probes = {${Object.entries(probes)
						.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
						.join(",\n")}};
const out = {};
for (const [k, v] of Object.entries(probes)) {
	try {
		const res = await Promise.race([v(), new Promise(r=>setTimeout(()=>r('TIMEOUT'), ${opts.timeout ?? 4000}))]);
		out[k] = res;
	} catch (e) { out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message); }
}
await new Promise(r=>setTimeout(r,${opts.settle ?? 2000}));
const log = await (await fetch('/__log')).json();
const hits = log.filter(p => p.includes(R)).map(p => p.split('?')[0].replace(R, 'R'));
const strip = (x) => JSON.parse(JSON.stringify(x).split(R).join('R').split(location.origin).join('ORIGIN'));
const res = {out: strip(out), hits, errors: window.__rv18errs || []};
console.log('RV18PROBE ' + JSON.stringify(res));
fail('RV18PROBE ' + JSON.stringify(res));
}, false);`);
				} else if (u.includes("/img/")) {
					res.writeHead(200, {
						"Content-Type": "image/png",
					});
					res.end(PNG);
				} else {
					res.writeHead(404);
					res.end("nf");
				}
			});
		},
	});
}

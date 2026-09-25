import { serverTest } from "../../../testcommon.ts";

// In the TOP-level proxied document, `client.topUrl` is cached on first read
// (the initial URL). rewriteUrl adds `$top` whenever topUrl !== current URL,
// so after a pushState or a hash change every client-side rewritten URL gains
// `&$top=...`. The module map is keyed by URL, so a module imported before and
// after the navigation is evaluated twice.
function page(name: string, body: string) {
	return serverTest({
		name,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const u = req.url.split("?")[0];
				if (u === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><html><head></head><body><script type="module">
window.__count = {};
runTest(async () => {
${body}
}, false);
</script></body></html>`);
				} else if (u.endsWith(".js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.__count[${JSON.stringify(u)}]=(window.__count[${JSON.stringify(u)}]||0)+1; export const id = Math.random(); export const url = import.meta.url;`
					);
				} else {
					res.writeHead(200, {
						"Content-Type": "text/plain",
					});
					res.end("ok");
				}
			});
		},
	});
}

const tests = [
	page(
		"rv10-topnav-import-after-pushstate",
		`
	const a = await import('/mod-a.js');
	history.pushState({}, '', '/route2');
	const b = await import('/mod-a.js');
	console.log('RV10TOP ' + JSON.stringify({count: window.__count, same: a === b, urla: a.url, urlb: b.url}));
	assertEqual(window.__count['/mod-a.js'], 1, 'module evaluated once');
	assert(a === b, 'same module namespace');
	pass();
	`
	),
	page(
		"rv10-topnav-import-after-hash",
		`
	const a = await import('/mod-h.js');
	location.hash = 'section2';
	const b = await import('/mod-h.js');
	console.log('RV10TOP ' + JSON.stringify({count: window.__count, same: a === b}));
	assertEqual(window.__count['/mod-h.js'], 1, 'module evaluated once');
	pass();
	`
	),
	page(
		"rv10-topnav-script-module-after-pushstate",
		`
	const load = (src) => new Promise(r => { const s = document.createElement('script'); s.type = 'module'; s.src = src; s.onload = () => r('load'); s.onerror = () => r('error'); document.head.appendChild(s); });
	await load('/mod-s.js');
	history.pushState({}, '', '/route3');
	const imp = await import('/mod-s.js');
	console.log('RV10TOP ' + JSON.stringify({count: window.__count}));
	assertEqual(window.__count['/mod-s.js'], 1, 'module script + later import() share one instance');
	pass();
	`
	),
	page(
		"rv10-topnav-url-shape",
		`
	const a = document.createElement('a');
	const before = (a.setAttribute('href','/x'), document.createElement('img'));
	const i1 = document.createElement('img'); i1.src = '/p1.png';
	history.pushState({}, '', '/route4');
	const i2 = document.createElement('img'); i2.src = '/p2.png';
	// read the live (rewritten) attribute via a serialization that bypasses the unrewrite
	const raw = (el) => { const r = []; new MutationObserver(()=>{}); return el.outerHTML; };
	const w = new XMLSerializer();
	console.log('RV10TOP ' + JSON.stringify({s1: w.serializeToString(i1), s2: w.serializeToString(i2)}));
	assert(!w.serializeToString(i2).includes('%24top'), 'no $top after pushState in top frame');
	pass();
	`
	),
];

// A link created after a pushState in the top frame carries `$top=<initial URL>`;
// following it, the next page's SW-side meta.topUrl is the stale carried one,
// so its HTML-rewritten URLs carry `$top` while wasm-rewritten module
// specifiers do not (review #10's asymmetry, now in the top frame).
const linknav = serverTest({
	name: "rv10-topnav-link-after-pushstate",
	start: async (server) => {
		server.on("request", (req: any, res: any) => {
			const u = req.url.split("?")[0];
			if (u === "/") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><body><script>
history.pushState({}, '', '/spa-route');
const a = document.createElement('a'); a.href = '/p2'; a.textContent = 'go'; document.body.appendChild(a);
setTimeout(() => a.click(), 50);
</script></body></html>`);
			} else if (u === "/p2") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><head><script type="module" src="/entry.js"></script></head><body><script type="module">
window.__count = window.__count || {};
runTest(async () => {
	await new Promise(r => setTimeout(r, 300));
	await import('/chunk.js');
	await new Promise(r => setTimeout(r, 100));
	const imgs = [...document.querySelectorAll('script[src]')].map(s => new XMLSerializer().serializeToString(s));
	console.log('RV10TOP ' + JSON.stringify({count: window.__count, loc: location.href, imgs}));
	assertEqual(window.__entry, 1, 'entry evaluated once');
	pass();
}, false);
</script></body></html>`);
			} else if (u === "/entry.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(
					`window.__entry = (window.__entry||0) + 1; export const e = 1;`
				);
			} else if (u === "/chunk.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(`import { e } from "/entry.js"; export const c = e;`);
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	},
});

const linknavCtrl = serverTest({
	name: "rv10-topnav-link-control-no-pushstate",
	start: async (server) => {
		server.on("request", (req: any, res: any) => {
			const u = req.url.split("?")[0];
			if (u === "/") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><body><script>

const a = document.createElement('a'); a.href = '/p2'; a.textContent = 'go'; document.body.appendChild(a);
setTimeout(() => a.click(), 50);
</script></body></html>`);
			} else if (u === "/p2") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><head><script type="module" src="/entry.js"></script></head><body><script type="module">
window.__count = window.__count || {};
runTest(async () => {
	await new Promise(r => setTimeout(r, 300));
	await import('/chunk.js');
	await new Promise(r => setTimeout(r, 100));
	const imgs = [...document.querySelectorAll('script[src]')].map(s => new XMLSerializer().serializeToString(s));
	console.log('RV10TOP ' + JSON.stringify({count: window.__count, loc: location.href, imgs}));
	assertEqual(window.__entry, 1, 'entry evaluated once');
	pass();
}, false);
</script></body></html>`);
			} else if (u === "/entry.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(
					`window.__entry = (window.__entry||0) + 1; export const e = 1;`
				);
			} else if (u === "/chunk.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(`import { e } from "/entry.js"; export const c = e;`);
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	},
});

// SPA deep route reload: pushState writes the stale `$top` into the frame's own
// URL, so a reload is served as a subframe of the *old* top URL.
const reloadnav = serverTest({
	name: "rv10-topnav-reload-after-pushstate",
	start: async (server) => {
		server.on("request", (req: any, res: any) => {
			const u = req.url.split("?")[0];
			if (u === "/" || u === "/deep/route") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><head><script type="module" src="/entry.js"></script></head><body><script type="module">
runTest(async () => {
	if (location.pathname === '/') {
		await new Promise(r => setTimeout(r, 100));
		history.pushState({}, '', '/deep/route');
		sessionStorage.setItem('rv10reload', '1');
		location.reload();
		return;
	}
	await new Promise(r => setTimeout(r, 300));
	await import('/chunk.js');
	await new Promise(r => setTimeout(r, 100));
	assertEqual(window.__entry, 1, 'entry evaluated once after reload on a pushed route');
	pass();
}, false);
</script></body></html>`);
			} else if (u === "/entry.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(
					`window.__entry = (window.__entry||0) + 1; export const e = 1;`
				);
			} else if (u === "/chunk.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(`import { e } from "/entry.js"; export const c = e;`);
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	},
});

const locnav = serverTest({
	name: "rv10-topnav-location-after-pushstate",
	start: async (server) => {
		server.on("request", (req: any, res: any) => {
			const u = req.url.split("?")[0];
			if (u === "/") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><body><script>
history.pushState({}, '', '/spa-route');
setTimeout(() => { location.href = '/p2'; }, 50);
</script></body></html>`);
			} else if (u === "/p2") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				res.end(`<!doctype html><html><head><script type="module" src="/entry.js"></script></head><body><script type="module">
window.__count = window.__count || {};
runTest(async () => {
	await new Promise(r => setTimeout(r, 300));
	await import('/chunk.js');
	await new Promise(r => setTimeout(r, 100));
	const imgs = [...document.querySelectorAll('script[src]')].map(s => new XMLSerializer().serializeToString(s));
	console.log('RV10TOP ' + JSON.stringify({count: window.__count, loc: location.href, imgs}));
	assertEqual(window.__entry, 1, 'entry evaluated once');
	pass();
}, false);
</script></body></html>`);
			} else if (u === "/entry.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(
					`window.__entry = (window.__entry||0) + 1; export const e = 1;`
				);
			} else if (u === "/chunk.js") {
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(`import { e } from "/entry.js"; export const c = e;`);
			} else {
				res.writeHead(404);
				res.end();
			}
		});
	},
});

export default [...tests, linknav, linknavCtrl, reloadnav, locnav];

import { serverTest } from "../../../testcommon.ts";

const workerBody = `
const out = {};
const t = async (k, f) => { try { out[k] = await Promise.race([f(), new Promise(r=>setTimeout(()=>r('TIMEOUT'),2500))]); } catch (e) { out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message); } };
(async () => {
await t('origin', () => self.origin);
await t('loc', () => location.href);
await t('settimeout_fn', () => new Promise(r => setTimeout(r, 10, 'ok')));
await t('settimeout_str', () => new Promise(r => { self.__r = r; setTimeout("self.__r('strok:' + location.pathname)", 10); }));
await t('setinterval', () => new Promise(r => { let n=0; const id = setInterval(() => { if (++n==3) { clearInterval(id); r(n); } }, 5); }));
await t('settimeout_this', () => { try { setTimeout.call({}, ()=>{}, 0); return 'no throw'; } catch(e) { return 'throw ' + e.name; } });
await t('settimeout_self', () => new Promise(r => self.setTimeout(() => r('selfok'), 1)));
await t('fetch_rel', async () => { const r = await fetch('echo/w?x=1'); return [r.status, r.url, await r.text()]; });
await t('xhr', () => new Promise(r => { const x = new XMLHttpRequest(); x.open('GET', 'echo/xhr'); x.onload = () => r([x.status, x.responseURL, x.responseText]); x.onerror = () => r('err'); x.send(); }));
await t('perf_res', async () => { await fetch('echo/perf'); return performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('echo')); });
await t('perf_byname', async () => performance.getEntriesByName(new URL('echo/perf', location.href).href).length);
await t('bc', () => { const b = new BroadcastChannel('wbc'); const n = b.name; b.close(); return n; });
await t('idb', () => new Promise(r => { const q = indexedDB.open('wdb'); q.onsuccess = () => { r(q.result.name); q.result.close(); }; q.onerror = () => r('err'); }));
await t('caches', async () => { const c = await caches.open('wc'); await c.put('/wc1', new Response('x')); const m = await c.match('/wc1'); return m ? await m.text() : null; });
await t('nested', () => new Promise(r => { try { const w2 = new Worker('nested.js'); w2.onmessage = e => r(e.data); w2.onerror = e => r('error ' + e.message); } catch (e) { r('THROW ' + e); } }));
await t('blob_nested', () => new Promise(r => { try { const w2 = new Worker(URL.createObjectURL(new Blob(['postMessage([self.origin, location.href.slice(0,5)])'], {type:'text/javascript'}))); w2.onmessage = e => r(e.data); w2.onerror = e => r('error ' + e.message); } catch (e) { r('THROW ' + e); } }));
await t('importScripts', () => { importScripts('imp.js'); return self.__imp; });
await t('eval', () => eval('location.pathname'));
await t('fn', () => new Function('return location.pathname')());
await t('evsrc', () => typeof EventSource);
await t('ws', () => { try { const w = new WebSocket('ws://localhost:1/x'); w.close(); return w.url; } catch (e) { return 'THROW ' + e.message; } });
await t('addEL', () => new Promise(r => { self.addEventListener('rvtest', e => r(e.type)); self.dispatchEvent(new Event('rvtest')); }));
await t('queueMicrotask', () => new Promise(r => queueMicrotask(() => r('mt'))));
await t('structuredClone', () => structuredClone({a:1}).a);
await t('reportError', () => typeof reportError);
await t('nav', () => [navigator.userAgent.length > 0, typeof navigator.serviceWorker, navigator.onLine]);
postMessage(out);
})();
`;

export default [
	serverTest({
		name: "rv11-worker-surface",
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><body><script>
						runTest(async () => {
							const run = (w) => new Promise(r => { w.onmessage = e => r(e.data); w.onerror = e => r('ERROR ' + e.message); setTimeout(() => r('TIMEOUT'), 15000); });
							const res = {};
							res.dedicated = await run(new Worker('/w/worker.js'));
							res.blob = await run(new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerBody).replace(/<\//g, "<\\/")}], {type: 'text/javascript'}))));
							console.log('RV11PROBE ' + JSON.stringify({"rv11-worker-surface": res}));
							fail('RV11PROBE ' + JSON.stringify({"rv11-worker-surface": res}));
						}, false);
					</script></body>`);
				} else if (path === "/w/worker.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(workerBody);
				} else if (path.endsWith("nested.js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`postMessage(['nested', self.origin, location.pathname, typeof setTimeout]);`
					);
				} else if (path.endsWith("imp.js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`self.__imp = 'imported ' + location.pathname;`);
				} else if (path.includes("echo")) {
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Access-Control-Allow-Origin": "*",
					});
					res.end(req.url);
				} else {
					res.writeHead(404);
					res.end("nf");
				}
			});
		},
	}),
];

import { serverTest } from "../../../testcommon.ts";

const FN = `function probeFn(a){ var u = location.href; var p = window.parent; return a + u.length + (p === window); }`;

export default [
	serverTest({
		name: "rv11-fn-tostring",
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><head><script src="/ext.js"></script><script>window.inlineFn = ${FN.replace("probeFn", "inlineFn")};</script><script type=module>window.modFn = ${FN.replace("probeFn", "modFn")};</script></head><body><button id=b onclick="return location.href">x</button><script>
					runTest(async () => {
						await new Promise(r => setTimeout(r, 300));
						const out = {};
						const want = (name) => ${JSON.stringify(FN)}.replace('probeFn', name);
						const chk = (k, f, name) => { try { const s = String(f); out[k] = s === want(name) ? 'same' : s; } catch (e) { out[k] = 'THROW ' + e; } };
						chk('ext', window.extFn, 'extFn');
						chk('inline', window.inlineFn, 'inlineFn');
						chk('module', window.modFn, 'modFn');
						eval('window.evalFn = ' + want('evalFn'));
						chk('eval', window.evalFn, 'evalFn');
						(0, eval)('window.ievalFn = ' + want('ievalFn'));
						chk('ieval', window.ievalFn, 'ievalFn');
						chk('newFunction', new Function('return ' + want('nfFn'))(), 'nfFn');
						const s = document.createElement('script'); s.text = 'window.dynFn = ' + want('dynFn'); document.body.appendChild(s);
						chk('dynscript', window.dynFn, 'dynFn');
						const s2 = document.createElement('script'); s2.src = '/ext2.js'; await new Promise(r => { s2.onload = r; s2.onerror = r; document.body.appendChild(s2); });
						chk('dynext', window.ext2Fn, 'ext2Fn');
						await new Promise(r => { window.__r = r; setTimeout('window.stFn = ' + want('stFn') + '; window.__r()', 0); });
						chk('settimeout', window.stFn, 'stFn');
						const m = await import('/mod.js'); chk('dynimport', m.default, 'impFn');
						out.arrow = String(window.extArrow);
						out.klass = String(window.ExtClass).slice(0, 200);
						out.method = String(window.ExtClass && window.ExtClass.prototype.m);
						out.handlerProp = String(document.getElementById('b').onclick);
						// the inline-worker pattern: build a worker from a function's source
						out.inlineWorker = await new Promise(r => {
							const src = '(' + window.extWorkerFn.toString() + ')()';
							const w = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
							w.onmessage = e => r(e.data); w.onerror = e => r('ERROR ' + e.message); setTimeout(() => r('TIMEOUT'), 5000);
						});
						out.nativeFn = String(document.querySelector);
						out.bound = String(window.extFn.bind(null));
						console.log('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring": out}));
						fail('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring": out}));
					}, false);
					</script></body>`);
				} else if (path === "/ext.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.extFn = ${FN.replace("probeFn", "extFn")};\nwindow.extArrow = (x) => location.pathname + x;\nwindow.ExtClass = class ExtClass { m(){ return top.location.href; } };\nwindow.extWorkerFn = function(){ postMessage([typeof location, location.protocol, self.origin, typeof importScripts]); };`
					);
				} else if (path === "/ext2.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`window.ext2Fn = ${FN.replace("probeFn", "ext2Fn")};`);
				} else if (path === "/mod.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(`export default ${FN.replace("probeFn", "impFn")};`);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];

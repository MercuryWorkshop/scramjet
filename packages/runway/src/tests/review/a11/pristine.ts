import { probeTest } from "./lib.ts";

// "grab clean natives from a fresh iframe, call them on the parent" pattern
const F = `const f = document.createElement('iframe'); f.style.display='none'; document.body.appendChild(f); const W = f.contentWindow;`;

export default [
	probeTest({
		name: "rv11-pristine-natives",
		probes: {
			settimeout: `${F} return await new Promise(r => { try { W.setTimeout.call(window, () => r('ok'), 0); } catch (e) { r('THROW ' + e); } setTimeout(() => r('TIMEOUT'), 1500); });`,
			settimeout_bare: `${F} const st = W.setTimeout; return await new Promise(r => { try { st(() => r('ok'), 0); } catch (e) { r('THROW ' + e); } setTimeout(() => r('TIMEOUT'), 1500); });`,
			fetch_call: `${F} const r = await W.fetch.call(window, 'echo/pf'); return [r.status, await r.text(), r.url];`,
			fetch_bare: `${F} const fe = W.fetch; const r = await fe('echo/pf2'); return [r.status, await r.text(), r.url];`,
			xhr_foreign_ctor: `${F} return await new Promise(r => { const x = new W.XMLHttpRequest(); x.open('GET', 'echo/px'); x.onload = () => r([x.status, x.responseText, x.responseURL]); x.onerror = () => r('err'); x.send(); });`,
			xhr_proto_open: `${F} return await new Promise(r => { const x = new XMLHttpRequest(); W.XMLHttpRequest.prototype.open.call(x, 'GET', 'echo/px2'); x.onload = () => r([x.status, x.responseText]); x.onerror = () => r('err'); x.send(); });`,
			setattr_proto: `${F} const a = document.createElement('a'); W.Element.prototype.setAttribute.call(a, 'href', '/pa'); return [a.getAttribute('href'), a.href];`,
			href_desc: `${F} const a = document.createElement('a'); Object.getOwnPropertyDescriptor(W.HTMLAnchorElement.prototype, 'href').set.call(a, '/pb'); return [a.getAttribute('href'), a.href, Object.getOwnPropertyDescriptor(W.HTMLAnchorElement.prototype, 'href').get.call(a)];`,
			innerhtml_desc: `${F} const d = document.createElement('div'); Object.getOwnPropertyDescriptor(W.Element.prototype, 'innerHTML').set.call(d, '<img src="/pc.png">'); return [d.firstChild.getAttribute('src'), d.firstChild.src, Object.getOwnPropertyDescriptor(W.Element.prototype, 'innerHTML').get.call(d)];`,
			appendchild_proto: `${F} const s = document.createElement('script'); s.textContent = 'window.__pr = location.pathname'; W.Node.prototype.appendChild.call(document.body, s); return window.__pr;`,
			append_proto: `${F} const s = document.createElement('script'); s.textContent = 'window.__pr2 = location.pathname'; W.Element.prototype.append.call(document.body, s); return window.__pr2;`,
			ael_proto: `${F} return await new Promise(r => { W.EventTarget.prototype.addEventListener.call(window, 'message', e => r([e.data, e.origin === location.origin])); postMessage('pm', '*'); setTimeout(() => r('TIMEOUT'), 1500); });`,
			pm_proto: `${F} return await new Promise(r => { addEventListener('message', function h(e){ if (e.data !== 'pm2') return; removeEventListener('message', h); r([e.data, e.origin === location.origin, e.source === window]); }); try { W.postMessage.call(window, 'pm2', '*'); } catch (e) { r('THROW ' + e); } setTimeout(() => r('TIMEOUT'), 1500); });`,
			loc_desc: `${F} try { return Object.getOwnPropertyDescriptor(W.Document.prototype, 'URL').get.call(document); } catch (e) { return 'THROW ' + e; }`,
			cookie_desc: `${F} document.cookie = 'pz=1'; try { return Object.getOwnPropertyDescriptor(W.Document.prototype, 'cookie').get.call(document); } catch (e) { return 'THROW ' + e; }`,
			qs_proto: `${F} const a = document.createElement('a'); a.href = '/pqs'; document.body.appendChild(a); return W.Document.prototype.querySelectorAll.call(document, 'a[href="/pqs"]').length;`,
			ls_proto: `${F} localStorage.setItem('pk', 'pv'); try { return [W.Storage.prototype.getItem.call(localStorage, 'pk'), W.localStorage.getItem('pk')]; } catch (e) { return 'THROW ' + e; }`,
			fn_tostring: `${F} return W.Function.prototype.toString.call(window.fetch);`,
			createObjectURL: `${F} const u = W.URL.createObjectURL(new Blob(['x'])); const r = await fetch(u); return [u.slice(0, 30), await r.text()];`,
			history_proto: `${F} try { W.History.prototype.pushState.call(history, null, '', '?pristine=1'); return location.search; } catch (e) { return 'THROW ' + e; }`,
			wopen: `${F} try { const w = W.open.call(window, 'about:blank', '_blank'); const ok = !!w; w && w.close(); return ok; } catch (e) { return 'THROW ' + e; }`,
			sendbeacon: `${F} try { return W.navigator.sendBeacon.call(navigator, 'echo/pbeacon', 'x'); } catch (e) { return 'THROW ' + e; }`,
			get_computed: `${F} try { return typeof W.getComputedStyle.call(window, document.body).color; } catch (e) { return 'THROW ' + e; }`,
			raf: `${F} return await new Promise(r => { try { W.requestAnimationFrame.call(window, () => r('ok')); } catch (e) { r('THROW ' + e); } setTimeout(() => r('TIMEOUT'), 1500); });`,
		},
	}),
];

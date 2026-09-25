import { hdrTest } from "./nonce.ts";

const pop = `<!DOCTYPE html><script>
const r = { k: location.pathname + location.search, opener: window.opener === null ? "null" : typeof window.opener, name: window.name, ref: document.referrer.replace(/:\\d+/, ":P"), hist: history.length };
try { r.openerOrigin = window.opener && window.opener.location.origin.replace(/:\\d+/, ":P"); } catch (e) { r.openerOrigin = "ERR " + e.name; }
const bc = new BroadcastChannel("pop"); bc.postMessage(r);
if (window.opener) try { window.opener.postMessage(r, "*"); } catch (e) {}
setTimeout(() => window.close(), 300);
</script>`;

const js = `
runTest(async () => {
	const out = {};
	const got = {};
	const bc = new BroadcastChannel("pop"); bc.onmessage = e => got[e.data.k] = e.data;
	const X = "http://127.0.0.1:" + location.port;
	const r1 = window.open("/p.html?1", "_blank", "noopener"); out.noopenerRet = r1 === null ? "null" : typeof r1;
	const r2 = window.open("/p.html?2", "_blank", "noreferrer"); out.noreferrerRet = r2 === null ? "null" : typeof r2;
	const r3 = window.open("/p.html?3", "named"); out.normalRet = r3 === null ? "null" : typeof r3;
	const r4 = window.open(X + "/p.html?4", "_blank", "popup,noopener=yes"); out.noopenerYes = r4 === null ? "null" : typeof r4;
	const a = document.createElement("a"); a.href = "/p.html?5"; a.target = "_blank"; a.rel = "noopener"; document.body.append(a); a.click();
	const b = document.createElement("a"); b.href = X + "/p.html?6"; b.target = "_blank"; document.body.append(b); b.click();
	const c = document.createElement("a"); c.href = "/p.html?7"; c.target = "_blank"; c.rel = "opener"; document.body.append(c); c.click();
	out.relList = [a.relList.contains("noopener"), a.rel, c.rel];
	await new Promise(r => setTimeout(r, 4000));
	out.popups = got;
	assertConsistent("opener", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-opener",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
			"/p.html": {
				body: pop,
			},
		},
	}),
];

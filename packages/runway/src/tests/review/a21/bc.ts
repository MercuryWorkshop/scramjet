import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;
const W = `
	const bc = new BroadcastChannel("rv21bc");
	bc.onmessage = (e) => { if (e.data === "ping") bc.postMessage({ echo: e.data, origin: e.origin, name: bc.name, src: e.source }); };
	bc.postMessage({ hello: self.constructor.name });
`;
export default [
	withOrigins(
		"rv21-bc-worker-frames",
		`
		${PRE}
		const R = {};
		const bc = new BroadcastChannel("rv21bc");
		const got = [];
		bc.onmessage = (e) => got.push({ d: e.data, o: e.origin === location.origin ? "SELF" : e.origin, s: e.source, lei: e.lastEventId, p: e.ports.length });
		const w = new Worker("/bcw.js");
		const w2 = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(W)}], { type: "text/javascript" })));
		const sw = new SharedWorker("/bcsw.js");
		const f = document.createElement("iframe"); f.src = "/bcframe"; document.body.appendChild(f);
		const f2 = document.createElement("iframe"); f2.srcdoc = "<script>" + ${JSON.stringify(W)} + "<\/script>"; document.body.appendChild(f2);
		const x = document.createElement("iframe"); x.src = P[0] + "/bcframe"; document.body.appendChild(x);
		await new Promise((r) => setTimeout(r, 1500));
		bc.postMessage("ping");
		await new Promise((r) => setTimeout(r, 1000));
		R.hellos = JSON.stringify(got.filter((g) => g.d && g.d.hello).map((g) => g.d.hello + ":" + g.o + ":" + g.s + ":" + g.p).sort());
		R.echoes = JSON.stringify(got.filter((g) => g.d && g.d.echo).map((g) => g.d.echo + ":" + (g.d.origin === location.origin ? "SELF" : g.d.origin) + ":" + g.d.name + ":" + g.o).sort());
		R.name = bc.name;
		R.closedPost = (() => { const c = new BroadcastChannel("z"); c.close(); try { c.postMessage(1); return "ok"; } catch (e) { return e.name; } })();
		R.uncloneable = (() => { try { bc.postMessage(() => 1); return "ok"; } catch (e) { return e.name + ":" + e.message.replace(/BroadcastChannel|MessagePort/, "X"); } })();
		${report}
	`,
		() => ({
			"/bcframe": [H, `<!doctype html><script>${W}</script>`],
		}),
		{
			mainFiles: () => ({
				"/bcw.js": [J, W],
				"/bcsw.js": [J, W],
				"/bcframe": [H, `<!doctype html><script>${W}</script>`],
			}),
		}
	),
] as Test[];

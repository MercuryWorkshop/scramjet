import { basicTest, type Test } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv21-worker-swcontainer",
		js: `
		const src = \`(async () => {
			const out = { has: "serviceWorker" in navigator };
			try {
				const c = navigator.serviceWorker;
				out.controller = String(c && c.controller && c.controller.scriptURL);
				const reg = await Promise.race([c.ready, new Promise((r) => setTimeout(() => r(null), 1500))]);
				out.readyScope = reg ? reg.scope : "none";
			} catch (e) { out.err = String(e); }
			postMessage(out);
		})()\`;
		const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
		const r = await new Promise((res) => w.onmessage = (e) => res(e.data));
		const w2 = new Worker("data:text/javascript," + encodeURIComponent(src));
		const r2 = await new Promise((res) => { w2.onmessage = (e) => res(e.data); setTimeout(() => res("timeout"), 4000); });
		fail("WSW " + JSON.stringify({ window: "serviceWorker" in navigator, blobWorker: r, dataWorker: r2 }));
	`,
	}),
] as Test[];

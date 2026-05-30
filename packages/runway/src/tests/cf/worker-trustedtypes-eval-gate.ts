import { basicTest } from "../../testcommon.ts";

// Ported from data4/payload2_lifted.js:13 and the worker callsites at
// payload2_lifted.js:319-328, 5489-5505.
//
// The hoisted worker source creates a Trusted Types policy when available and
// only evals posted code when the worker MessageEvent matches Cloudflare's gate:
//   e.isTrusted && e.origin === "" && e.source === null
// Turnstile then posts eval strings into that worker and waits for postMessage
// responses such as { HDKQo6: "zMbJz1" } and timeout markers.

export default basicTest({
	name: "cf-worker-trustedtypes-eval-gate",
	timeoutMs: 10000,
	js: `
		const workerSource = "var _p=null;if(self.trustedTypes)try{_p=self.trustedTypes.createPolicy('ysPu6',{createScript:function(s){return s;}})}catch(e){self.postMessage({type:'tt-policy-error',msg:e.message})}onmessage=function(e){e.isTrusted&&''===e.origin&&null===e.source&&eval(_p?_p.createScript(e.data):e.data)}";
		const blob = new Blob([workerSource], { type: "text/javascript" });
		const blobUrl = URL.createObjectURL(blob);
		const workerUrl = typeof window.cAtV0 === "function" ? window.cAtV0(blobUrl) : blobUrl;
		const worker = new Worker(workerUrl);

		try {
			const messages = [];
			const result = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("worker eval gate timed out")), 5000);
				worker.onerror = (event) => {
					clearTimeout(timeout);
					reject(new Error("worker error: " + event.message));
				};
				worker.onmessage = (event) => {
					messages.push(event.data);
					if (event.data && event.data.HDKQo6 === "zMbJz1") {
						clearTimeout(timeout);
						resolve({ messages, final: event.data });
					}
				};
				worker.postMessage("postMessage({ HDKQo6: 'zMbJz1', hasNavigator: !!self.navigator, originGateReached: true });");
			});

			assert(result.final.HDKQo6 === "zMbJz1",
				"worker should eval posted code after the isTrusted/origin/source gate");
			assert(result.final.originGateReached === true,
				"worker eval payload should run to completion");
			assertConsistent("worker-trustedtypes-eval-gate", {
				messageCount: result.messages.length,
				finalKeys: Object.keys(result.final).sort(),
				hasNavigator: result.final.hasNavigator,
			});
		} finally {
			worker.terminate();
			URL.revokeObjectURL(blobUrl);
		}
	`,
});

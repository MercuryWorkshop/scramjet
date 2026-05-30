import { basicTest } from "../../testcommon.ts";

// Ported from data4 deobfuscated gate:
// internal-cf-reverse/data4/deobf_only.js:4072-4125
//   Create Blob({type:"text/javascript"}) → URL.createObjectURL → new Worker
//   → URL.revokeObjectURL → worker.terminate(), then gate on
//   ReadableStream.prototype.pipeTo, BigInt, crypto.getRandomValues,
//   and PerformanceObserver.

export default basicTest({
	name: "cf-attestation-capability-gate",
	js: `
		let workerFailed = false;
		let worker;
		let url;
		try {
			url = URL.createObjectURL(new Blob(['"you"==="bot"'], { type: "text/javascript" }));
			const workerUrl = typeof window.cAtV0 === "function" ? window.cAtV0(url) : url;
			worker = new Worker(workerUrl);
		} catch (_) {
			workerFailed = true;
		} finally {
			if (url) URL.revokeObjectURL(url);
			if (worker) worker.terminate();
		}

		const gate = {
			workerFailed,
			readableStreamPipeToMissing: typeof ReadableStream === "undefined" || ReadableStream.prototype.pipeTo === undefined,
			bigIntMissing: !window.BigInt,
			cryptoGetRandomValuesMissing: !window.crypto || !crypto.getRandomValues,
			performanceObserverMissing: typeof PerformanceObserver !== "function",
		};

		assertConsistent("attestation-capability-gate", gate);
	`,
});

import { basicTest } from "../../testcommon.ts";

// Exact worker eval payload from payload2_lifted.js:27426-27435:
//   arg_0.OIrLs2.postMessage("setTimeout(function(){self.postMessage({ WukfE7:\"1\"})},55)")
//   then read message.data.WukfE7.
// The worker source is the hoisted trusted-types/eval gate at payload2_lifted.js:13.

export default basicTest({
	name: "cf-worker-timeout-wukfe7-message",
	timeoutMs: 10000,
	js: `
    const workerSource = "var _p=null;if(self.trustedTypes)try{_p=self.trustedTypes.createPolicy('ysPu6',{createScript:function(s){return s;}})}catch(e){self.postMessage({type:'tt-policy-error',msg:e.message})}onmessage=function(e){e.isTrusted&&''===e.origin&&null===e.source&&eval(_p?_p.createScript(e.data):e.data)}";
    const blob = new Blob([workerSource], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const workerUrl = typeof window.cAtV0 === "function" ? window.cAtV0(blobUrl) : blobUrl;
    const worker = new Worker(workerUrl);

    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WukfE7 worker message timed out")), 5000);
        worker.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error("worker error: " + event.message));
        };
        worker.onmessage = (event) => {
          if (event.data && event.data.WukfE7) {
            clearTimeout(timeout);
            resolve({ data: event.data, wukfe7: event.data.WukfE7, keys: Object.keys(event.data).sort() });
          }
        };
        worker.postMessage('setTimeout(function(){self.postMessage({ WukfE7:"1"})},55)');
      });

      assert(result.wukfe7 === "1", "WukfE7 worker payload mismatch");
      assertConsistent("worker-timeout-wukfe7-message", result);
    } finally {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
    }
  `,
});

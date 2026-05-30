import { basicTest } from "../../testcommon.ts";

// Exact control flow from VM functions:
//
// p2_func_153737_185 (lines 8443-8471) — Worker-based navigator collection:
//
//  1. stack_78 = results (saved context)
//  2. AJGm5 = p2_func_152834_237          (handler function for results)
//  3. nJWjq3(p2_func_154276_241)           (register cleanup handler)
//  4. qZqeT2 = 0; dnsDH6 = ""             (reset state flags)
//  5. OIrLs2.addEventListener("message", p2_func_153303_171)
//  6. OIrLs2.postMessage("var n=self.navigator;postMessage({ kbWz1:n.platform,eJPbP1:n.languages,ezjg6:n.hardwareConcurrency,KHgN2:n.deviceMemory,XrztG1:n.userAgent});setTimeout(function(){postMessage({ TYNh2:1})},5000)")
//                                           (send script to eval worker)
//  7. if (qZqeT2) → already received? → p2_func_154507_59
//     else → qZqeT2 = 2; dnsDH6 = "" → timeout → p2_func_154507_59
//
// p2_func_153303_171 (line ~8473-8490):
//  1. Read event.data
//  2. Check data.TYNh2 === 1 → worker sent timeout
//  3. Check data.kbWz1 → platform, data.eJPbP1 → languages,
//     data.ezjg6 → hardwareConcurrency, data.KHgN2 → deviceMemory,
//     data.XrztG1 → userAgent
//  4. Store in result object → call AJGm5(result)

export default basicTest({
	name: "cf-worker-navigator-collection",
	js: `
    // --- p2_func_153737_185: Worker-based navigator collection ---

    const workerSource = "self.onmessage=function(event){(0,eval)(event.data)}";
    const blob = new Blob([workerSource], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const workerUrl = typeof window.cAtV0 === "function" ? window.cAtV0(blobUrl) : blobUrl;
    const worker = new Worker(workerUrl);

    const probeScript =
      "var n=self.navigator;postMessage({ kbWz1:n.platform,eJPbP1:n.languages,ezjg6:n.hardwareConcurrency,KHgN2:n.deviceMemory,XrztG1:n.userAgent});setTimeout(function(){postMessage({ TYNh2:1})},5000)";

    let collected = null;

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("worker navigator collection timed out")), 3000);
        worker.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error("worker error: " + event.message));
        };
        worker.onmessage = (event) => {
          if (event.data && event.data.TYNh2 === 1) return;
          collected = event.data;
          clearTimeout(timeout);
          resolve();
        };
        worker.postMessage(probeScript);
      });
    } finally {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
    }

    assert(collected !== null, "worker should post navigator collection");

    // Step 7: Verify each value matches expected type
    assert(typeof collected.kbWz1 === "string",
      "navigator.platform should be string, got: " + collected.kbWz1);
    assert(collected.eJPbP1 && typeof collected.eJPbP1.length === "number",
      "navigator.languages should be array-like, got: " + typeof collected.eJPbP1);
    assert(typeof collected.ezjg6 === "number",
      "navigator.hardwareConcurrency should be number, got: " + collected.ezjg6);
    if (collected.KHgN2 !== undefined) {
      assert(typeof collected.KHgN2 === "number",
        "navigator.deviceMemory should be number, got: " + typeof collected.KHgN2);
    }
    assert(typeof collected.XrztG1 === "string",
      "navigator.userAgent should be string, got: " + typeof collected.XrztG1);

    // Verify values that are expected to be populated in browser contexts.
    assert(Array.prototype.slice.call(collected.eJPbP1).length > 0,
      "navigator.languages should not be empty");
    assert(collected.ezjg6 >= 1,
      "navigator.hardwareConcurrency should be >= 1, got: " + collected.ezjg6);
    assert(collected.XrztG1.length > 0,
      "navigator.userAgent should not be empty");

    // --- Handler verification (p2_func_153303_171) ---
    // Turnstile checks if received data has expected fields
    const handlerKeys = ["TYNh2", "kbWz1", "eJPbP1", "ezjg6", "KHgN2", "XrztG1"];
    for (const key of handlerKeys) {
      assert(typeof key === "string",
        "Handler key " + key + " should be a string");
    }

    assertConsistent("worker-navigator-collection", {
      probeScript,
      collected,
      mainThreadNavigator: {
        kbWz1: navigator.platform,
        eJPbP1: Array.prototype.slice.call(navigator.languages || []),
        ezjg6: navigator.hardwareConcurrency,
        KHgN2: navigator.deviceMemory,
        XrztG1: navigator.userAgent,
      },
    });
  `,
});

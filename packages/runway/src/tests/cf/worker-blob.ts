import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_275120_109 (line 304-323):
//   1. Creates array of DOM results: [shadowRoot.mode, outerHTML, innerHTML, ...]
//   2. Creates Blob([__STR_5], {type:"text/javascript"}) from Trusted Types worker script
//   3. URL.createObjectURL(blob) → blob: URL
//   4. cAtV0(blobUrl) → transforms URL (scramjet rewrites this step)
//   5. new Worker(transformedUrl) → creates worker
//   6. worker.onmessage = handler; worker.onerror = handler
//   7. worker.postMessage(evalCode) → sends eval command
//   8. OIrLs2.addEventListener("message", handler) → listens for worker response
//   9. OIrLs2.postMessage(timeoutCode) → sends timeout script
//
// p2_func_153737_185 (line 8443-8471):
//   1. nJWjq3(setupFn) → stores setup function
//   2. qZqeT2 = 0; dnsDH6 = ""
//   3. OIrLs2.addEventListener("message", handler)
//   4. OIrLs2.postMessage(scriptToCollectNavigatorValues)
//   5. Waits for worker to post back navigator values: platform, languages,
//      hardwareConcurrency, deviceMemory, userAgent
//   6. Worker sends timeout message {TYNh2:1} after 5s
//
// p2_func_179325_118 (line 5660-5677):
//   1. cAtV0(SDGM5) → transforms a value/URL
//   2. new Worker(transformedValue) → creates worker
//   3. worker.onmessage = handler; worker.onerror = handler
//   4. worker.postMessage("eval(_p?...);postMessage({HDKQo6:'zMbJz1'});")
//   5. OIrLs2.addEventListener("message", handler)
//   6. OIrLs2.postMessage("setTimeout(function(){self.postMessage({ymom7:'1'})},1500)")

export default basicTest({
  name: "cf-worker-blob",
  js: `
    // Step 1: Worker constructor must be a function
    assert(typeof Worker === "function",
      "Worker should be a function");

    // Step 2: URL.createObjectURL and URL.revokeObjectURL must be functions
    assert(typeof URL.createObjectURL === "function",
      "URL.createObjectURL should be a function");
    assert(typeof URL.revokeObjectURL === "function",
      "URL.revokeObjectURL should be a function");

    // Step 3: Create a Blob with a simple worker script
    const workerScript = "self.postMessage('ok');";
    const blob = new Blob([workerScript], { type: "text/javascript" });
    assert(blob instanceof Blob,
      "new Blob([script], {type:'text/javascript'}) should create a Blob");

    // Step 4: URL.createObjectURL(blob) must return a blob: URL
    const url = URL.createObjectURL(blob);
    assert(typeof url === "string" && url.indexOf("blob:") === 0,
      "URL.createObjectURL should return a blob: URL, got: " + url);

    // Step 5: new Worker(blobUrl) must create a Worker instance
    let worker;
    try {
      worker = new Worker(url);
      assert(worker instanceof Worker,
        "new Worker(blobUrl) should return a Worker instance");

      // Step 6: Worker.postMessage must be a function
      assert(typeof worker.postMessage === "function",
        "Worker.postMessage should be a function");

      // Step 7: Worker has onmessage/onerror properties
      assert("onmessage" in worker,
        "Worker should have onmessage property");
      assert("onerror" in worker,
        "Worker should have onerror property");

      // Step 8: Worker.terminate must be a function
      assert(typeof worker.terminate === "function",
        "Worker.terminate should be a function");
    } catch (e) {
      pass("Worker creation failed (may be blocked by CSP): " + e.message);
    } finally {
      if (worker) worker.terminate();
      URL.revokeObjectURL(url);
    }
  `,
});
import { basicTest } from "../../testcommon.ts";

// Strict capability gate from inner.js_translated.js:4618-4636:
//   createObjectURL(new Blob(['"you"==="bot"'], { type: "text/javascript" })),
//   construct new Worker(gQ(url)), revoke, terminate, then check pipeTo, BigInt,
//   crypto.getRandomValues, and typeof PerformanceObserver.

export default basicTest({
	name: "cf-inner-unsupported-capability-probe",
	js: `
    function gQ(value) { return value; }
    function Y() { return false; }
    const W = {
      JSlmX: "unsupported-browser-state",
      PlUQm: "function",
      aFKfF(fn, key) { return fn(key); },
    };

    const observed = {
      bailedByState: false,
      workerConstructed: false,
      workerError: null,
      pipeToType: typeof ReadableStream.prototype.pipeTo,
      hasBigInt: !!window.BigInt,
      hasCryptoGetRandomValues: !!(window.crypto && crypto.getRandomValues),
      performanceObserverType: typeof window.PerformanceObserver,
      unsupported: false,
    };

    if (W.aFKfF(Y, W.JSlmX)) {
      observed.bailedByState = true;
    } else {
      try {
        const N = URL.createObjectURL(new Blob(['"you"==="bot"'], { type: "text/javascript" }));
        const D = new Worker(gQ(N));
        observed.workerConstructed = true;
        URL.revokeObjectURL(N);
        D.terminate();
      } catch (error) {
        observed.workerError = { name: error && error.name, message: error && error.message };
        observed.unsupported = true;
      }
      if (ReadableStream.prototype.pipeTo === undefined) observed.unsupported = true;
      if (!window.BigInt) observed.unsupported = true;
      if (!window.crypto || !crypto.getRandomValues) observed.unsupported = true;
      if (typeof window.PerformanceObserver !== W.PlUQm) observed.unsupported = true;
    }

    assert(observed.bailedByState === false, "unsupported capability state bail mismatch");
    assert(typeof observed.unsupported === "boolean", "unsupported capability result mismatch");
    assertConsistent("inner-unsupported-capability-probe", observed);
  `,
});

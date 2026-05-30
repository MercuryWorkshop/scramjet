import { basicTest } from "../../testcommon.ts";

// Exact PerformanceObserver setup from inner.js_translated.js:7375-7384:
//   new PerformanceObserver((list) => list.getEntries().forEach(q1))
//   observe({ entryTypes: ["resource", "navigation"] })

export default basicTest({
	name: "cf-performance-observer-resource-navigation",
	timeoutMs: 10000,
	js: `
    const observed = {
      PerformanceObserverType: typeof window.PerformanceObserver,
      supportedEntryTypes: Array.isArray(PerformanceObserver?.supportedEntryTypes)
        ? PerformanceObserver.supportedEntryTypes.filter((entryType) => entryType === "resource" || entryType === "navigation")
        : [],
      records: [],
      observeError: undefined,
    };

    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          observed.records.push({
            entryType: entry.entryType,
            name: entry.name,
            initiatorType: entry.initiatorType,
          });
        });
      });

      try {
        observer.observe({ entryTypes: ["resource", "navigation"] });
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        observed.observeError = String(error && error.message || error);
      } finally {
        observer.disconnect();
      }
    }

    assert(observed.PerformanceObserverType === "function", "PerformanceObserver should be function");
    assert(observed.observeError === undefined, "PerformanceObserver observe should not throw: " + observed.observeError);
    assertConsistent("performance-observer-resource-navigation", observed);
  `,
});

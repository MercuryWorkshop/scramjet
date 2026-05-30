import { basicTest } from "../../testcommon.ts";

// Ports q2 PerformanceObserver setup from data4/inner.js_translated.js:7364-7385.

export default basicTest({
	name: "cf-inner-performance-observer-entrytypes",
	js: `
    const previous = window.PerformanceObserver;
    const observedCalls = [];
    const entries = [{ name: "a" }, { name: "b" }];
    const consumed = [];

    try {
      window.PerformanceObserver = class {
        constructor(callback) { this.callback = callback; }
        observe(options) {
          observedCalls.push(options);
          this.callback({ getEntries: () => entries });
        }
      };
      function q1(entry) { consumed.push(entry.name); }
      function q2() {
        const W = new window.PerformanceObserver((f) => {
          f.getEntries().forEach(q1);
        });
        W.observe({ entryTypes: ["resource", "navigation"] });
      }
      q2();

      const observed = { observeOptions: observedCalls[0], consumed };
      assert(observed.observeOptions.entryTypes.join(",") === "resource,navigation", "q2 should observe resource and navigation entries");
      assert(consumed.join(",") === "a,b", "observer callback should feed q1");
      assertConsistent("inner-performance-observer-entrytypes", observed);
    } finally {
      window.PerformanceObserver = previous;
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact beginning of the performance memory branch from payload2_lifted.js:27302-27314
// and surrounding gate at 27548-27568:
//
//   window.performance
//   performance.memory
//   Object.getPrototypeOf(performance.memory)
//   Object.getOwnPropertyNames(proto)
//   names.length
//
// The later loop is register-damaged, so this strict port stops at the raw
// observable prototype-name collection before the damaged iteration.

export default basicTest({
	name: "cf-performance-memory-prototype-names",
	js: `
    const memory = performance && performance.memory;
    const observed = {
      performanceType: typeof performance,
      memoryType: typeof memory,
      names: null,
      namesLength: null,
    };

    if (memory) {
      const proto = Object.getPrototypeOf(memory);
      const names = Object.getOwnPropertyNames(proto);
      observed.names = names;
      observed.namesLength = names.length;
    }

    assert(observed.performanceType === "object",
      "performance should be an object, got: " + observed.performanceType);
    assertConsistent("performance-memory-prototype-names", observed);
  `,
});

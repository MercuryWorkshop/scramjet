import { basicTest } from "../../testcommon.ts";

// Exact console method chain from payload2_lifted.js:18457-18479:
//
//   window.console.trace
//   window.console.warn
//
// The lifted code reads each property and feeds typeof into the collector.

export default basicTest({
	name: "cf-console-method-typeof-chain",
	js: `
    const observed = {
      consoleType: typeof window.console,
      trace: typeof window.console.trace,
      warn: typeof window.console.warn,
    };

    assert(observed.trace === "function", "console.trace should be function");
    assert(observed.warn === "function", "console.warn should be function");

    assertConsistent("console-method-typeof-chain", observed);
  `,
});

import { basicTest } from "../../../testcommon.ts";

export default [
	// The `callsites` npm package pattern (also depd, source-map-support,
	// Error-stack capture helpers bundled into browser code): swap in a
	// formatter that returns the raw CallSite array, read `.stack`, restore.
	basicTest({
		name: "rv0-prepare-stack-trace-assignable",
		js: `
			const saved = Error.prepareStackTrace;
			Error.prepareStackTrace = (_, stack) => stack;
			const stack = new Error().stack;
			Error.prepareStackTrace = saved;
			assert(Array.isArray(stack), "Error.prepareStackTrace assignment is honoured; got " + typeof stack);
			assert(typeof stack[0].getFileName === "function", "CallSite objects");
		`,
	}),
	basicTest({
		name: "rv0-prepare-stack-trace-reads-back",
		js: `
			const f = (_, s) => s;
			Error.prepareStackTrace = f;
			const readBack = Error.prepareStackTrace;
			Error.prepareStackTrace = undefined;
			assert(readBack === f, "reads back what was assigned");
		`,
	}),
];

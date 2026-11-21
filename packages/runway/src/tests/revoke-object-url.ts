import { basicTest } from "../testcommon.ts";

// URL.revokeObjectURL never throws natively: anything that isn't one of this
// page's blob URLs is ignored
const inputs: [string, string][] = [
	["empty", '""'],
	["https", '"https://example.com/a.png"'],
	["undefined", "undefined"],
	["null", "null"],
	["data", '"data:text/plain,hi"'],
	["relative", '"/foo"'],
	["blob-bad", '"blob:nonsense"'],
];

export default [
	basicTest({
		name: "revoke-object-url-never-throws",
		js: `
			const errs = [];
			${inputs.map(([label, expr]) => `try { URL.revokeObjectURL(${expr}); } catch (e) { errs.push(${JSON.stringify(label)} + ": " + e); }`).join("\n")}
			assertEqual(errs.join(" | "), "", "revokeObjectURL never throws");
		`,
	}),
];

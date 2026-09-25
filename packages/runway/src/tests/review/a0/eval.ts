import { basicTest } from "../../../testcommon.ts";

const forms: Record<string, string> = {
	comma: `(0,eval)(SRC)`,
	windowEval: `window.eval(SRC)`,
	call: `eval.call(window, SRC)`,
	alias: `const e = eval; e(SRC)`,
	globalThisEval: `globalThis.eval(SRC)`,
	functionCtor: `new Function(SRC)()`,
};
export default [
	...Object.entries(forms).map(([k, f]) =>
		basicTest({
			name: `rv0-eval-indirect-var-${k}`,
			js: `
				${f.replace("SRC", JSON.stringify(`var rv0Leak_${k} = 'yes'; function rv0Fn_${k}() { return 1 }`))};
				${
					k === "functionCtor"
						? `assertEqual(window["rv0Leak_${k}"], undefined, "Function body var stays local");`
						: `
				assertEqual(window["rv0Leak_${k}"], "yes", "indirect eval var becomes a global");
				assertEqual(typeof window["rv0Fn_${k}"], "function", "indirect eval function decl becomes a global");`
				}
			`,
		})
	),
	basicTest({
		name: "rv0-eval-indirect-completion-value",
		js: `
			assertEqual((0,eval)("1+1"), 2, "completion value");
			assertEqual((0,eval)("'use strict'; 5"), 5, "directive then value");
			assertEqual((0,eval)("var z = 3; z"), 3, "var then value");
			assertDeepEqual((0,eval)("({a:1})"), {a:1}, "object literal");
		`,
	}),
];

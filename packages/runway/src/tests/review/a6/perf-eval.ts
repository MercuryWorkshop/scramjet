import { basicTest, type Test } from "../../../testcommon.ts";

const x = basicTest({
	name: "rv6-pe-eval",
	js: `
	const time = (fn) => { const s = performance.now(); fn(); return Math.round(performance.now() - s); };
	const out = {};
	out.evalUnique5k = time(() => { for (let i = 0; i < 5000; i++) eval("1+" + i); });
	out.evalSame5k = time(() => { for (let i = 0; i < 5000; i++) eval("1+1"); });
	out.newFn5k = time(() => { for (let i = 0; i < 5000; i++) new Function("a", "return a+" + i); });
	out.newFnSame5k = time(() => { for (let i = 0; i < 5000; i++) new Function("a", "return a+1"); });
	out.newFnCall5k = time(() => { for (let i = 0; i < 5000; i++) new Function("a", "return a+" + i)(1); });
	const m0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
	for (let i = 0; i < 20000; i++) new Function("a", "return a+" + i)(1);
	if (window.gc) gc();
	out.heapMBAfter20kFn = performance.memory ? Math.round((performance.memory.usedJSHeapSize - m0) / 1e6) : -1;
	throw new Error("RV6PERF " + JSON.stringify(out));
`,
});
x.timeoutMs = 120000;
export default [x] as Test[];

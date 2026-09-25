import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv8p2-perf-scripts",
		js: `
  const r = {};
  let t0 = performance.now(); for (let i = 0; i < 500; i++) { const x = document.createElement("script"); x.text = "window.__z = " + i; } r.textSetDetached500 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 500; i++) { const x = document.createElement("script"); x.textContent = "window.__z = " + i; } r.textContentSetDetached500 = performance.now() - t0;
  const x0 = document.createElement("script"); x0.text = "window.__z = 1";
  t0 = performance.now(); for (let i = 0; i < 500; i++) { const x = document.createElement("script"); x.text = "window.__z = " + i; document.head.appendChild(x); } r.textSetInsert500 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 500; i++) { eval("window.__z = " + i); } r.eval500 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 500; i++) { const x = document.createElement("script"); document.head.appendChild(x); } r.emptyInsert500 = performance.now() - t0;
  for (const k in r) r[k] = Math.round(r[k]);
  fail("RV8PERF " + JSON.stringify(r));
`,
	}),
];

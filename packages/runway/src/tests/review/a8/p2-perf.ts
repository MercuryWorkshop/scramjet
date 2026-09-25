import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv8p2-perf-rawtext",
		js: `
  const r = {};
  let s = document.createElement("style"); document.head.appendChild(s);
  let t0 = performance.now(); for (let i = 0; i < 1000; i++) s.appendChild(document.createTextNode(".q" + i + "{color:red}")); r.styleAppend1000 = performance.now() - t0; t0 = performance.now(); for (let i = 1000; i < 3000; i++) s.appendChild(document.createTextNode(".q" + i + "{color:red}")); r.styleAppendNext2000 = performance.now() - t0;
  s = document.createElement("style"); document.head.appendChild(s); const tn = document.createTextNode(""); s.appendChild(tn);
  try { t0 = performance.now(); for (let i = 0; i < 3000; i++) tn.appendData(".r" + i + "{color:red}"); r.styleAppendData3000 = performance.now() - t0; } catch (e) { r.styleAppendData3000 = -1 }
  t0 = performance.now(); for (let i = 0; i < 3000; i++) { const x = document.createElement("style"); x.textContent = ".z" + i + "{color:red}"; document.head.appendChild(x); } r.styleEls3000 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 1000; i++) { const x = document.createElement("script"); x.text = "window.__z = " + i; document.head.appendChild(x); } r.scripts1000 = performance.now() - t0;
  const d = document.createElement("div"); for (let i = 0; i < 2000; i++) { const p = document.createElement("p"); p.textContent = "x" + i; d.appendChild(p); } document.body.appendChild(d);
  t0 = performance.now(); for (let i = 0; i < 200; i++) document.body.textContent.length; r.bodyTextContent200 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 20000; i++) { const tt = document.createTextNode("a"); d.appendChild(tt); tt.data = "b"; tt.remove(); } r.textOps20000 = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 2000; i++) { d.firstChild.cloneNode(true); } r.clone2000 = performance.now() - t0;
  for (const k in r) r[k] = Math.round(r[k]);
  fail("RV8PERF " + JSON.stringify(r));
`,
	}),
];

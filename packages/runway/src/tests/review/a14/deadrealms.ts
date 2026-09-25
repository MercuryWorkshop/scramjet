import { basicTest } from "../../../testcommon.ts";

// Every hooked realm is registered in box.ctors forever, and develop's WebIDL
// conversions brand-check through box.instanceof, which scans every realm's
// constructor. How do hot DOM ops scale with the number of (dead) frames the
// page has ever created?
export default [
	basicTest({
		name: "rv14-deadrealms-perf",
		scramjetOnly: true,
		js: String.raw`
const d = document.createElement("div");
document.body.appendChild(d);
const bench = () => {
  const out = {};
  let t = performance.now();
  for (let i = 0; i < 5000; i++) d.append("x");
  out.appendStr = +((performance.now() - t) / 5).toFixed(3);
  d.textContent = "";
  t = performance.now();
  for (let i = 0; i < 5000; i++) { const s = document.createElement("span"); d.append(s); }
  out.appendNode = +((performance.now() - t) / 5).toFixed(3);
  d.textContent = "";
  t = performance.now();
  for (let i = 0; i < 2000; i++) d.insertAdjacentElement("beforeend", document.createElement("i"));
  out.insertAdj = +((performance.now() - t) / 2).toFixed(3);
  d.textContent = "";
  t = performance.now();
  for (let i = 0; i < 2000; i++) new Request("/x");
  out.request = +((performance.now() - t) / 2).toFixed(3);
  t = performance.now();
  for (let i = 0; i < 2000; i++) d.replaceChildren("a", "b");
  out.replaceChildren = +((performance.now() - t) / 2).toFixed(3);
  return out;
};
const res = { n0: bench() };
let made = 0;
for (const target of [100, 300]) {
  for (; made < target; made++) { const f = document.createElement("iframe"); document.body.appendChild(f); void f.contentWindow; f.remove(); }
  res["n" + target] = bench();
}
// objects from the most recently created live frame
const f = document.createElement("iframe"); document.body.appendChild(f);
const cd = f.contentDocument;
let t = performance.now();
for (let i = 0; i < 2000; i++) d.append(cd.createElement("b"));
res.foreignNodeAppend = +((performance.now() - t) / 2).toFixed(3);
fail("RV14DEAD (us/op) " + JSON.stringify(res));
`,
	}),
];

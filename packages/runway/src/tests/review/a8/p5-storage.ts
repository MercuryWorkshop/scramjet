import { basicTest } from "../../../testcommon.ts";
export default [
	basicTest({
		name: "rv8p5-localstorage-roundtrip",
		js: `
  localStorage.clear();
  const samples = ["/* comment */ x", "a\\u2028b\\u2029c", "é漢字😀", "x".repeat(2000000), JSON.stringify({ items: { "a@1": "function(){/*x*/ return [1,2](3)}" } })];
  for (const s of samples) { localStorage.setItem("k", s); const got = localStorage.getItem("k"); assertEqual(got === s, true, "roundtrip len " + s.length + " got " + (got && got.length)); }
  localStorage["prop"] = "v"; assertEqual(localStorage.getItem("prop"), "v");
  localStorage.clear();
`,
	}),
	basicTest({
		name: "rv8p5-indirect-eval-large",
		js: `
  const parts = [];
  for (let i = 0; i < 400; i++) parts.push("mw_impl(" + JSON.stringify("m" + i) + ", function($, jQuery){ /* c" + i + " */ var a = [" + i + "]; return a[0] + location.host.length; });");
  window.mw_impl = () => {};
  const src = parts.join("\\n");
  (1, eval)(src);
  new Function(src)();
  window.eval(src);
`,
	}),
];

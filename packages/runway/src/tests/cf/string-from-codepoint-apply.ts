import { basicTest } from "../../testcommon.ts";

// Exact primitive from payload2_lifted.js:8253-8257:
//   const fn = String.fromCodePoint; fn.apply(null, arg_0)

export default basicTest({
	name: "cf-string-from-codepoint-apply",
	js: `
    const arg = [0x1f1fa, 0x1f1f8];
    const fn = String.fromCodePoint;
    const out = fn.apply(null, arg);
    const observed = {
      fnType: typeof fn,
      arg,
      out,
      length: out.length,
      codePoints: Array.from(out).map((char) => char.codePointAt(0)),
    };

    assert(observed.fnType === "function", "String.fromCodePoint should be function");
    assert(observed.codePoints.length === arg.length, "fromCodePoint code point count mismatch");
    assert(observed.codePoints.every((codePoint, index) => codePoint === arg[index]),
      "fromCodePoint code points mismatch: " + observed.codePoints.join(","));
    assertConsistent("string-from-codepoint-apply", observed);
  `,
});

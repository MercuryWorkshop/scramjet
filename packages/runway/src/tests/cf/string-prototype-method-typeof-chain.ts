import { basicTest } from "../../testcommon.ts";

// Exact String prototype method chain from payload2_lifted.js:14883-14935;
// alternate entry at 15621-15646 also includes charAt/charCodeAt.
//
//   String.prototype.charCodeAt -> "charCodeAt"
//   String.prototype.includes   -> "includes"
//   String.prototype.indexOf    -> "indexOf"
//   String.prototype.toString   -> "toString"
//   String.prototype.charAt     -> "charAt" (alternate contiguous entry)
//
// Preserve intended method types and the damaged owner type.

export default basicTest({
	name: "cf-string-prototype-method-typeof-chain",
	js: `
    const proto = String.prototype;
    const observed = {
      prototypeTypeDamaged: typeof proto,
      charAt: typeof proto.charAt,
      charCodeAt: typeof proto.charCodeAt,
      includes: typeof proto.includes,
      indexOf: typeof proto.indexOf,
      toString: typeof proto.toString,
    };

    for (const [name, type] of Object.entries(observed)) {
      if (name === "prototypeTypeDamaged") continue;
      assert(type === "function", "String.prototype." + name + " should be function, got: " + type);
    }

    assertConsistent("string-prototype-method-typeof-chain", observed);
  `,
});

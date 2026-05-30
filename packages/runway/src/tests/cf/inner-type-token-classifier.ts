import { basicTest } from "../../testcommon.ts";

// Ports the compact type classifier dV() from data4/inner.js_translated.js:6897-6935.

export default basicTest({
	name: "cf-inner-type-token-classifier",
	js: `
    function dV(W, T) {
      if (T == null) return T === void 0 ? "u" : "x";
      const N = typeof T;
      if (N === "object") {
        try {
          if (W.Promise && T instanceof W.Promise) return T.catch(function() {}), "p";
        } catch (D) {}
      }
      const ds = { object: "o", string: "s", undefined: "u", symbol: "z", number: "n", bigint: "I" };
      return W.Array.isArray(T) ? "a"
        : T === W.Array ? "p5"
        : T === true ? "T"
        : T === false ? "F"
        : N == "function" ? (T instanceof W.Function && W.Function.prototype.toString.call(T).indexOf("[native code]") > 0 ? "N" : "f")
        : ds[N] || "?";
    }

    const observed = {
      undefinedToken: dV(window, undefined),
      nullToken: dV(window, null),
      arrayToken: dV(window, []),
      arrayCtorToken: dV(window, Array),
      trueToken: dV(window, true),
      falseToken: dV(window, false),
      stringToken: dV(window, "x"),
      numberToken: dV(window, 1),
      bigintToken: typeof BigInt === "function" ? dV(window, BigInt(1)) : "missing",
      promiseToken: dV(window, Promise.resolve(1)),
      userFunctionToken: dV(window, function custom() {}),
      nativeFunctionToken: dV(window, Array.prototype.push),
    };

    assert(observed.undefinedToken === "u" && observed.nullToken === "x", "null/undefined tokens should match source");
    assert(observed.arrayToken === "a" && observed.arrayCtorToken === "p5", "array tokens should match source");
    assertConsistent("inner-type-token-classifier", observed);
  `,
});

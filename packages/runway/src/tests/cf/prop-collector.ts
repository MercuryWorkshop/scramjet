import { basicTest } from "../../testcommon.ts";

// Adapted from inner.js_translated.js:
//
// dV (lines 8422-8460): type tagger
//   - null -> 'x', undefined -> 'u'
//   - Promise -> 'p'
//   - Array -> 'a', Array constructor -> 'p5'
//   - true/false -> 'T'/'F'
//   - function -> 'N' if native, else 'f'
//   - ds mapping: object:'o', string:'s', undefined:'u', symbol:'z', number:'n', bigint:'I'
//
// dL (lines 6561-6569): prototype chain key collector
//
// RpnZR8 (lines 1097-1173):
//   - q6 = dL(f)
//   - concat Object.getOwnPropertyNames(f) when available
//   - dedupe via Set
//   - q7 = 'nAsAa'.split('A') -> ['n','s','a']
//   - for each key q9: qq = dV(T, f[q9])
//   - if qq in q7: numeric checks + special case for "d.cookie"
//   - else E(qd, qq)

export default basicTest({
	name: "cf-prop-collector",
	js: `
    function dV(W, T) {
      const S = {
        TzgUD: (D, Z) => D == Z,
        NZCGb: "function",
        fcZTO: (D, Z) => D > Z,
        MjOLS: "[native code]",
      };
      if (S.TzgUD(T, null)) return T === void 0 ? "u" : "x";
      const N = typeof T;
      if (N === "object") {
        try {
          if (W.Promise && T instanceof W.Promise) {
            T.catch(function() {});
            return "p";
          }
        } catch (D) {}
      }
      const ds = {
        object: "o",
        string: "s",
        undefined: "u",
        symbol: "z",
        number: "n",
        bigint: "I",
      };
      return W.Array.isArray(T)
        ? "a"
        : T === W.Array
        ? "p5"
        : T === true
        ? "T"
        : T === false
        ? "F"
        : N == S.NZCGb
        ? T instanceof W.Function && S.fcZTO(W.Function.prototype.toString.call(T).indexOf(S.MjOLS), 0)
          ? "N"
          : "f"
        : ds[N] || "?";
    }

    function dL(q) {
      for (var W = []; q !== null; W = W.concat(Object.keys(q)), q = Object.getPrototypeOf(q)) {}
      return W;
    }

    function RpnZR8(T, f, S, N) {
      const Z = {
        BmSWQ: (qw, qW) => qw + qW,
        wFOOg: (qw, qW) => qW === qw,
        BmgKM: (qw, qW) => qW === qw,
        sFdSz: (qw, qW) => qW === qw,
        ZhvnE: "d.cookie",
      };
      if (f === null || Z.wFOOg(f, void 0)) return N;
      let q6 = dL(f);
      if (T.Object.getOwnPropertyNames) q6 = q6.concat(T.Object.getOwnPropertyNames(f));
      q6 = T.Array.from && T.Set ? T.Array.from(new T.Set(q6)) : (function(qw) {
        qw.sort();
        for (let qW = 0; qW < qw.length; qw[qW + 1] === qw[qW] ? qw.splice(Z.BmSWQ(qW, 1), 1) : qW += 1);
        return qw;
      })(q6);
      const q7 = "nAsAa".split("A").includes.bind("nAsAa".split("A"));
      for (let q8 = 0; q8 < q6.length; q8++) {
        const q9 = q6[q8];
        const qd = S + q9;
        try {
          const qg = f[q9];
          const qq = dV(T, qg);
          if (q7(qq)) {
            let q9num = +qg;
            q9num = qq === "s" && Z.BmgKM(q9num, q9num);
            Z.sFdSz(qd, Z.ZhvnE) ? E(qd, qq) : q9num || E(qd, qg);
          } else {
            E(qd, qq);
          }
        } catch (qw) {
          E(qd, "i");
        }
      }
      return N;
      function E(qw, qW) {
        Object.prototype.hasOwnProperty.call(N, qW) || (N[qW] = []);
        N[qW].push(qw);
      }
    }

    const f = Object.create(null);
    f.num = 1;
    f.zero = 0;
    f.str = "5";
    f.strNaN = "foo";
    f.arr = [1];
    f.boolT = true;
    f.boolF = false;
    f.fn = function() {};
    f.native = Array;
    f.promise = Promise.resolve(1);
    f.nil = null;
    f.undef = undefined;
    f.obj = { a: 1 };
    f["d.cookie"] = "cookie";

    const result = RpnZR8(window, f, "o.", {});

    assert(Array.isArray(result.T) && result.T.includes("o.boolT"),
      "T bucket should contain o.boolT");
    assert(Array.isArray(result.F) && result.F.includes("o.boolF"),
      "F bucket should contain o.boolF");
    assert(Array.isArray(result.f) && result.f.includes("o.fn"),
      "f bucket should contain o.fn");
    assert(Array.isArray(result.N) && result.N.includes("o.native"),
      "N bucket should contain o.native");
    assert(Array.isArray(result.p) && result.p.includes("o.promise"),
      "p bucket should contain o.promise");
    assert(Array.isArray(result.x) && result.x.includes("o.nil"),
      "x bucket should contain o.nil");
    assert(Array.isArray(result.u) && result.u.includes("o.undef"),
      "u bucket should contain o.undef");
    assert(Array.isArray(result.o) && result.o.includes("o.obj"),
      "o bucket should contain o.obj");
    assert(Array.isArray(result.s) && result.s.includes("o.d.cookie"),
      "s bucket should contain o.d.cookie");
    assert(Array.isArray(result[0]) && result[0].includes("o.zero"),
      "0 bucket should contain o.zero");
    assert(Array.isArray(result.foo) && result.foo.includes("o.strNaN"),
      "foo bucket should contain o.strNaN");
  `,
});

import { basicTest } from "../../testcommon.ts";

// Ports api_ls_uu localStorage gate from data4/inner.js_translated.js:5912-5919.

export default basicTest({
	name: "cf-inner-api-ls-uu-localstorage-gate",
	js: `
    const key = "cf.turnstile.u";
    const previous = localStorage.getItem(key);
    try {
      function apply(opt, flags) {
        function Y(name) { return flags.includes(name); }
        let ql = opt.zFnv2;
        if (!Y("api_ls_uu")) {
          const qT = localStorage.getItem(key);
          qT && (ql = qT);
        }
        opt.lrZhP0 = ql;
        if (!Y("api_ls_uu")) localStorage.setItem(key, opt.lrZhP0);
        return { lrZhP0: opt.lrZhP0, stored: localStorage.getItem(key) };
      }

      localStorage.setItem(key, "stored-u");
      const ungated = apply({ zFnv2: "default-u" }, []);
      localStorage.setItem(key, "stored-u");
      const gated = apply({ zFnv2: "default-u" }, ["api_ls_uu"]);

      const observed = { ungated, gated };
      assert(ungated.lrZhP0 === "stored-u", "ungated path should read localStorage value");
      assert(gated.lrZhP0 === "default-u" && gated.stored === "stored-u", "api_ls_uu flag should avoid read/write");
      assertConsistent("inner-api-ls-uu-localstorage-gate", observed);
    } finally {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
    }
  `,
});

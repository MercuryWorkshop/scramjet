import { basicTest } from "../../testcommon.ts";

// Exact localStorage path from inner.js_translated.js:5912-5919, with helper
// gates forced open as oracle recommended:
//
//   ql = b._cf_chl_opt.zFnv2;
//   try { !Y("api_ls_uu") && (qT = localStorage.getItem("cf.turnstile.u"), qT && (ql = qT)); } catch {}
//   b._cf_chl_opt.lrZhP0 = ql;
//   try { !Y(W.oxlGG) && localStorage.setItem("cf.turnstile.u", b._cf_chl_opt.lrZhP0); } catch {}

export default basicTest({
	name: "cf-turnstile-localstorage-u",
	js: `
    const key = "cf.turnstile.u";
    const previous = localStorage.getItem(key);
    const previousCfOpt = window._cf_chl_opt;
    const stored = "stored-turnstile-u-runway";

    try {
      localStorage.setItem(key, stored);
      const b = window;
      const W = { oxlGG: "api_ls_write_u" };
      const Y = function() { return false; };
      let ql = b._cf_chl_opt = { zFnv2: "fallback-turnstile-u" };
      ql = b._cf_chl_opt.zFnv2;
      let qT;

      try {
        !Y("api_ls_uu") && (qT = localStorage.getItem("cf.turnstile.u"), qT && (ql = qT));
      } catch (qS) {}
      b._cf_chl_opt.lrZhP0 = ql;
      try {
        !Y(W.oxlGG) && localStorage.setItem("cf.turnstile.u", b._cf_chl_opt.lrZhP0);
      } catch (qf) {}

      const observed = {
        readValue: qT,
        lrZhP0: b._cf_chl_opt.lrZhP0,
        storedValue: localStorage.getItem(key),
      };

      assert(observed.readValue === stored, "localStorage read value mismatch");
      assert(observed.lrZhP0 === stored, "_cf_chl_opt.lrZhP0 mismatch");
      assert(observed.storedValue === stored, "localStorage writeback mismatch");
      assertConsistent("turnstile-localstorage-u", observed);
    } finally {
      if (previous === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previous);
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});

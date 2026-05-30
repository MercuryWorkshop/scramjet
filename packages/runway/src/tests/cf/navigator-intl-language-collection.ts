import { basicTest } from "../../testcommon.ts";

// Source-backed navigator/Intl collection from payload2_lifted.js:6727-6817
// and helper at 6820-6827:
//
//   navigator.language → IgaUX2, or "" when falsy
//   navigator.languages → yZEy2
//   _cf_chl_opt.gYZPc3 → uCrdo3
//   new Intl.DateTimeFormat(Intl, { month:"long", timeZoneName:"long" }).format(630883200000)
//   new Intl.DisplayNames(Intl, { type:"language" }).of("eo-UA")
//   new Intl.ListFormat(Intl, { style:"long", type:"disjunction" })
//      .format("Bippity-boppityaMumbo-jumboahocuspocus".split("a"))
//
// Passing the Intl object as the locales argument is unusual but source-exact;
// this test records thrown errors instead of substituting a safer locale.

export default basicTest({
	name: "cf-navigator-intl-language-collection",
	js: `
    const previousOpt = window._cf_chl_opt;
    try {
      window._cf_chl_opt = Object.assign({}, window._cf_chl_opt, { gYZPc3: "cf-runway-gYZPc3" });

      const out = {
        IgaUX2: navigator.language ? navigator.language : "",
        yZEy2: navigator.languages,
        EQzr8: "CollatorADateTimeFormatADisplayNamesAListFormatANumberFormatAPluralRulesARelativeTimeFormat".split("A"),
        uCrdo3: window._cf_chl_opt.gYZPc3,
      };

      function attempt(label, fn) {
        try {
          return { ok: true, value: fn() };
        } catch (error) {
          return { ok: false, name: error && error.name, message: error && error.message };
        }
      }

      const dateTime = attempt("DateTimeFormat", () => new Intl.DateTimeFormat(Intl, {
        month: "long",
        timeZoneName: "long",
      }).format(630883200000));
      const displayNames = attempt("DisplayNames", () => new Intl.DisplayNames(Intl, {
        type: "language",
      }).of("eo-UA"));
      const listFormat = attempt("ListFormat", () => new Intl.ListFormat(Intl, {
        style: "long",
        type: "disjunction",
      }).format("Bippity-boppityaMumbo-jumboahocuspocus".split("a")));

      assert(typeof out.IgaUX2 === "string", "IgaUX2 should be string");
      assert(out.yZEy2 && typeof out.yZEy2.length === "number", "yZEy2 should be array-like languages");
      assert(out.uCrdo3 === "cf-runway-gYZPc3", "uCrdo3 should copy _cf_chl_opt.gYZPc3");

      assertConsistent("navigator-intl-language-collection", {
        IgaUX2: out.IgaUX2,
        languages: Array.prototype.slice.call(out.yZEy2 || []),
        EQzr8: out.EQzr8,
        uCrdo3: out.uCrdo3,
        dateTime,
        displayNames,
        listFormat,
      });
    } finally {
      if (previousOpt === undefined) delete window._cf_chl_opt; else window._cf_chl_opt = previousOpt;
    }
  `,
});

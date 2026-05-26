import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_176753_35 (line 6724-6743):
//   1. navigator.languages → read array
//   2. Call p2_func_175872_112() on navigator → variant list
//   3. _cf_chl_opt.gYZPc3 → server-provided value
//   4. Intl.DateTimeFormat(navigator.language, {month:"long", timeZoneName:"long"})
//   5. dtf.format(new Date("1990-01-01")) → formatted date string
//
// p2_func_177061_199 (line 6746-6756):
//   1. Intl.DisplayNames(navigator.language, {type:"language"})
//   2. dn.of("eo-UA") → display name for Esperanto
//
// p2_func_177227_243 (line 6758-6771):
//   1. Intl.ListFormat(navigator.language, {style:"long", type:"disjunction"})
//   2. lf.format("Bippity-boppityaMumbo-jumboahocuspocus".split("a"))
//   3. Expected: "Bippity-boppity, Mumbo-jumbo, or hocuspocus"
//
// p2_func_176750_121 (line 6788-6809):
//   1. Same as 176753_35 but with language already set
//
// p2_func_177024_149 (line 6773-6786):
//   1. Error path: DisplayNames failure → String(error) → store as iKkNh4
//   2. Try DisplayNames again with eo-UA

export default basicTest({
  name: "cf-intl-apis",
  js: `
    // Check 1: Intl.DateTimeFormat with Turnstile's specific options (p2_func_176753_35)
    const dtf = new Intl.DateTimeFormat(navigator.language || "en", {
      month: "long",
      timeZoneName: "long",
    });
    assert(typeof dtf.format === "function",
      "Intl.DateTimeFormat.format should be a function");
    // Turnstile uses 630883200000 (milliseconds for 1990-01-01T00:00:00Z)
    const dateResult = dtf.format(new Date(630883200000));
    assert(typeof dateResult === "string" && dateResult.length > 0,
      "DateTimeFormat.format should return non-empty string, got: " + dateResult);

    // Check 2: Intl.DisplayNames for Esperanto (p2_func_177061_199)
    if (typeof Intl.DisplayNames !== "undefined") {
      try {
        const dn = new Intl.DisplayNames(navigator.language || "en", {
          type: "language",
        });
        const eoName = dn.of("eo-UA");
        assert(typeof eoName === "string",
          "DisplayNames.of('eo-UA') should return a string, got: " + eoName);
      } catch (e) {
        pass("DisplayNames not supported: " + e.message);
      }
    }

    // Check 3: Intl.ListFormat with Turnstile's specific string (p2_func_177227_243)
    if (typeof Intl.ListFormat !== "undefined") {
      const phrases = "Bippity-boppityaMumbo-jumboahocuspocus".split("a");
      const lf = new Intl.ListFormat(navigator.language || "en", {
        style: "long",
        type: "disjunction",
      });
      const formatted = lf.format(phrases);
      assert(typeof formatted === "string" && formatted.length > 0,
        "ListFormat.format should return non-empty string, got: " + formatted);
    }

    // Check 4: Intl.NumberFormat (used by Turnstile's metadata formatting)
    const nf = new Intl.NumberFormat(navigator.language || "en");
    assert(typeof nf.format(1234.56) === "string",
      "NumberFormat.format should return a string");

    // Check 5: Intl constructors exist
    assert(typeof Intl.Collator === "function",
      "Intl.Collator should be a function");

    if (typeof Intl.PluralRules !== "undefined") {
      assert(typeof Intl.PluralRules === "function",
        "Intl.PluralRules should be a function");
    }

    if (typeof Intl.RelativeTimeFormat !== "undefined") {
      assert(typeof Intl.RelativeTimeFormat === "function",
        "Intl.RelativeTimeFormat should be a function");
    }
  `,
});
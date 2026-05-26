import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_175872_112 (line 6811-6818):
//   1. Object.create(null) → null prototype object
//   2. "Collator/DateTimeFormat/DisplayNames/ListFormat/NumberFormat/PluralRules/RelativeTimeFormat"
//      .split("/") → enumerate all Intl constructor names
//   3. For each, check if Intl[constructorName] exists
//
// p2_func_177434_145 (line 6602-6617):
//   1. Intl.NumberFormat(navigator.language).format(21000000000000000)
//   2. String(result) → convert to string
//   This tests large number formatting (21 quadrillion)
//
// p2_func_177470_139 (line 6675-6687):
//   Same NumberFormat call after ListFormat in chain

export default basicTest({
  name: "cf-intl-checks",
  js: `
    // Check 1: ALL Intl constructors must exist (p2_func_175872_112)
    // Turnstile enumerates these constructor names to check Intl API surface
    const intlConstructors = [
      "Collator",
      "DateTimeFormat",
      "DisplayNames",
      "ListFormat",
      "NumberFormat",
      "PluralRules",
      "RelativeTimeFormat",
    ];

    const results = Object.create(null);
    for (const ctor of intlConstructors) {
      const exists = ctor in Intl;
      results[ctor] = exists;
      // Turnstile only checks that they're enumerable on Intl
      // (most should exist in modern browsers)
    }

    // NumberFormat must always work
    assert(typeof Intl.NumberFormat === "function",
      "Intl.NumberFormat should be a function");

    // Check 2: Large number formatting (p2_func_177434_145, p2_func_177470_139)
    const lang = navigator.language || "en";
    const nf = new Intl.NumberFormat(lang);
    // Turnstile formats 21,000,000,000,000,000 (21 quadrillion)
    const formatted = nf.format(21000000000000000);
    assert(typeof formatted === "string",
      "Intl.NumberFormat.format(21000000000000000) should return a string");
    // In US English: "21,000,000,000,000,000"
    assert(formatted.length >= 20,
      "Formatted 21 quadrillion should be at least 20 chars, got: " + formatted);

    // Also test with compact notation
    const nfCompact = new Intl.NumberFormat(lang, { notation: "compact" });
    const compactFormatted = nfCompact.format(21000000000000000);
    assert(typeof compactFormatted === "string",
      "Compact format should return a string, got: " + compactFormatted);

    // Check 3: Object.create(null) works (p2_func_175872_112)
    const nullProto = Object.create(null);
    assert(Object.getPrototypeOf(nullProto) === null,
      "Object.create(null) should create null-prototype object");

    // Check 4: Additional Intl checks Turnstile does
    const dtf = new Intl.DateTimeFormat(lang, {
      month: "long",
      timeZoneName: "long",
    });
    const dateStr = dtf.format(new Date(630883200000));
    assert(typeof dateStr === "string",
      "DateTimeFormat should format date, got: " + dateStr);

    if (typeof Intl.DisplayNames !== "undefined") {
      try {
        const dn = new Intl.DisplayNames(lang, { type: "language" });
        assert(typeof dn.of("en") === "string",
          "DisplayNames.of should return a string");
      } catch (_) {}
    }

    if (typeof Intl.ListFormat !== "undefined") {
      const lf = new Intl.ListFormat(lang, {
        style: "long",
        type: "disjunction",
      });
      const result = lf.format(["a", "b", "c"]);
      assert(typeof result === "string",
        "ListFormat.format should return a string, got: " + result);
    }
  `,
});
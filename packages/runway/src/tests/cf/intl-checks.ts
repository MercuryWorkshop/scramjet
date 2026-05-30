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
		// p2_func_175872_112 enumerates these constructor names against Intl.
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
			results[ctor] = ctor in Intl;
		}
		assertConsistent("intl-constructor-presence", results);

		// p2_func_177434_145 / p2_func_177470_139 format a large number with
		// compact long NumberFormat options.
		assert(typeof Intl.NumberFormat === "function",
			"Intl.NumberFormat should be a function");
		const lang = navigator.language || "en";
		const nf = new Intl.NumberFormat(lang, {
			notation: "compact",
			compactDisplay: "long",
		});
		const formatted = nf.format(21000000000000000);
		assertConsistent("intl-compact-large-number-format", String(formatted));

		const intlOutputs = {};
		if (typeof Intl.DateTimeFormat === "function") {
			intlOutputs.dateTime = new Intl.DateTimeFormat(lang, {
				month: "long",
				timeZoneName: "long",
			}).format(630883200000);
		}
		if (typeof Intl.DisplayNames === "function") {
			intlOutputs.displayName = new Intl.DisplayNames(lang, {
				type: "language",
			}).of("eo-UA");
		}
		if (typeof Intl.ListFormat === "function") {
			intlOutputs.list = new Intl.ListFormat(lang, {
				style: "long",
				type: "disjunction",
			}).format("Bippity-boppityaMumbo-jumboahocuspocus".split("a"));
		}
		assertConsistent("intl-format-outputs", intlOutputs);

		// The constructor-presence collector is initialized with Object.create(null).
		const nullProto = Object.create(null);
		assert(Object.getPrototypeOf(nullProto) === null,
			"Object.create(null) should create null-prototype object");
	`,
});

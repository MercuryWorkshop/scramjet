import { basicTest } from "../../testcommon.ts";

// Exact document.fonts.check call shape from payload2_lifted.js:7507-7518,
// with result sort/join behavior from nearby handlers described by the lifted
// loop:
//
//   document.fonts.check('12px "' + fontName + '"')
//   if matched, collect font key, sort array, join with "|"
//   error label path: "documentfonts_error"

export default basicTest({
	name: "cf-document-fonts-check-loop",
	js: `
    const fontNames = ["Arial", "Times New Roman", "monospace"];
    const observed = {
      fontsType: typeof document.fonts,
      checkType: document.fonts && typeof document.fonts.check,
      checks: [],
      matched: [],
      joined: "",
      errorLabel: null,
    };

    try {
      if (document.fonts && typeof document.fonts.check === "function") {
        for (const fontName of fontNames) {
          const query = '12px "' + fontName + '"';
          const ok = document.fonts.check(query);
          observed.checks.push([query, ok]);
          if (ok) observed.matched.push(fontName);
        }
        observed.matched.sort((a, b) => a.localeCompare(b));
        observed.joined = observed.matched.join("|");
      }
    } catch (error) {
      observed.errorLabel = "documentfonts_error";
      observed.errorName = error && error.name;
    }

    assertConsistent("document-fonts-check-loop", observed);
  `,
});

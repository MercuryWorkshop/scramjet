import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted probe:
// internal-cf-reverse/data4/payload2_lifted.js:10593-10604
//   document.fonts.check('12px "' + fontName + '"')

export default basicTest({
	name: "cf-fontface-check",
	js: `
		assert("fonts" in document, "document.fonts should exist");
		assert(typeof document.fonts.check === "function",
			"document.fonts.check should be a function");

		const fontNames = ["Arial", "Times New Roman", "monospace"];
		const results = [];
		for (const fontName of fontNames) {
			results.push([fontName, document.fonts.check('12px "' + fontName + '"')]);
		}

		assertConsistent("fontface-check-results", results);
	`,
});

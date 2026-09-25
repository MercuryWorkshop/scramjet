import { basicTest } from "../../../testcommon.ts";

// XMLSerializer is not hooked, so it shows the live (rewritten) attribute.
export default [
	basicTest({
		name: "rv2-srcset-candidates",
		scramjetOnly: true,
		js: `
			const live = (v) => { const i = document.createElement("img"); i.setAttribute("srcset", v); return new XMLSerializer().serializeToString(i).match(/ srcset="([^"]*)"/)[1]; };
			const a = live("/s.jpg 300w, /m.jpg 600w, /l.jpg 1200w");
			assert(a.split(", ").length === 3 && a.includes("m.jpg") && a.includes("300w"), "rewritten srcset lost candidates/descriptors: " + a);
		`,
	}),
];

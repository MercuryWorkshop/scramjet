import { basicTest } from "../../testcommon.ts";

// HTMLElement.prototype.innerText trap: shares its rewrite-and-stash logic
// with the Node.prototype.textContent trap. These tests guard the script /
// style branches against regressing the dedup.

export default [
	basicTest({
		name: "innertext-script-roundtrip",
		js: `
			const s = document.createElement("script");
			const src = "top.foo;";
			s.innerText = src;
			assertEqual(s.innerText, src, "script.innerText should round-trip its source");
			assertEqual(s.textContent, src, "script.textContent should match");
		`,
	}),
	basicTest({
		name: "innertext-textcontent-dedup-no-regression",
		js: `
			const s = document.createElement("script");
			const src = "top.bar;";
			s.textContent = src;
			assertEqual(s.textContent, src, "script.textContent should round-trip after the innerText dedup");
			assertEqual(s.innerText, src, "innerText should agree with textContent");
		`,
	}),
	basicTest({
		name: "innertext-style-roundtrip",
		js: `
			const s = document.createElement("style");
			const css = ".x { color: red; }";
			s.innerText = css;
			assertEqual(s.innerText, css, "style.innerText should round-trip the unrewritten CSS");
			assertEqual(s.textContent, css, "style.textContent should match");
		`,
	}),
	basicTest({
		name: "innertext-style-textcontent-dedup",
		js: `
			const s = document.createElement("style");
			const css = ".y { background: blue; }";
			s.textContent = css;
			assertEqual(s.textContent, css, "style.textContent should round-trip after the dedup");
			assertEqual(s.innerText, css, "innerText should agree with textContent");
		`,
	}),
];

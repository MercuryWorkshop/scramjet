import { basicTest } from "../../testcommon.ts";

// url() references have to be rewritten on the way in and un-rewritten on the
// way out, through the CSSOM as well as through markup. Setting a background
// image from script and then serializing the element is an everyday thing:
// carousels, lazy-loaders, theme switchers, and any framework that diffs the
// style attribute.

export default [
	basicTest({
		name: "cssurls-setattribute-roundtrip",
		js: `
			const d = document.createElement("div");
			d.setAttribute("style", "background-image: url(/bg.png)");
			assertEqual(d.getAttribute("style"), "background-image: url(/bg.png)", "style attribute round trip");
			assert(!d.outerHTML.includes("/~/sj/"), "outerHTML: " + d.outerHTML);
		`,
	}),
	basicTest({
		name: "cssurls-parsed-markup-roundtrip",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<div style="background-image: url(/bg.png)"></div>';
			assertEqual(d.innerHTML, '<div style="background-image: url(/bg.png)"></div>', "innerHTML round trip");
			assert(!d.innerHTML.includes("/~/sj/"), "no proxy URL in innerHTML");
		`,
	}),
	basicTest({
		name: "cssurls-stylesheet-csstext",
		js: `
			const st = document.createElement("style");
			st.textContent = ".a { background-image: url(/x.png); }";
			document.head.appendChild(st);
			assert(!st.sheet.cssRules[0].cssText.includes("/~/sj/"),
				"cssRules[0].cssText leaks the proxy URL: " + st.sheet.cssRules[0].cssText);
			st.sheet.insertRule(".b { background-image: url(/y.png); }", 1);
			assertEqual(st.sheet.cssRules.length, 2, "insertRule");
			assert(!st.sheet.cssRules[1].cssText.includes("/~/sj/"),
				"inserted rule cssText leaks: " + st.sheet.cssRules[1].cssText);
			assert(!st.textContent.includes("/~/sj/"), "textContent leaks the proxy URL: " + st.textContent);
		`,
	}),
	basicTest({
		name: "cssurls-non-url-properties",
		js: `
			const d = document.createElement("div");
			d.style.color = "red";
			d.style.top = "5px";
			d.style.setProperty("--custom", "12px");
			assertEqual(d.style.color, "red", "color");
			assertEqual(d.style.top, "5px", "top");
			assertEqual(d.style.getPropertyValue("--custom"), "12px", "custom property");
			assertEqual(d.getAttribute("style"), "color: red; top: 5px; --custom: 12px;", "style attribute");
			assertEqual(d.style.length, 3, "style.length");
			d.style.removeProperty("color");
			assertEqual(d.style.color, "", "removeProperty");
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: a CSSOM write stores the fully-rewritten proxy URL in the
		// style attribute, so serializing the element exposes it. Anything that
		// reads outerHTML/innerHTML after setting a background image from script
		// - templating, snapshot diffing, "copy element" tooling - carries the
		// proxy URL with it.
		name: "cssurls-cssom-write-serialization",
		js: `
			const d = document.createElement("div");
			d.style.backgroundImage = "url(/bg.png)";
			assert(!d.outerHTML.includes("/~/sj/"), "outerHTML must not expose the proxy URL: " + d.outerHTML);
			assertEqual(d.getAttribute("style"), 'background-image: url("/bg.png");', "style attribute");
			const c = document.createElement("div");
			c.style.cssText = "background-image: url(/bg.png)";
			assert(!c.outerHTML.includes("/~/sj/"), "cssText write: " + c.outerHTML);
		`,
	}),
	basicTest({
		// KNOWN FAILURE: getComputedStyle hands back the proxy URL. Lazy-loaders
		// and image-preloaders read the computed background to decide what to
		// fetch, and anything comparing it against a known URL fails.
		name: "cssurls-computed-style",
		js: `
			const d = document.createElement("div");
			d.style.backgroundImage = "url(/bg.png)";
			document.body.appendChild(d);
			const c = getComputedStyle(d).backgroundImage;
			assert(!c.includes("/~/sj/"), "computed style leaks the proxy URL: " + c);
			assertEqual(c, 'url("' + location.origin + '/bg.png")', "computed style resolves to the real URL");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: cssText on a rule is un-rewritten but reading the same
		// value through the rule's style declaration is not.
		name: "cssurls-cssrule-style-property",
		js: `
			const st = document.createElement("style");
			st.textContent = ".a { background-image: url(/x.png); }";
			document.head.appendChild(st);
			const rule = st.sheet.cssRules[0];
			assertEqual(rule.style.backgroundImage, 'url("/x.png")', "rule.style.backgroundImage");
			assertEqual(rule.style.getPropertyValue("background-image"), 'url("/x.png")', "getPropertyValue");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: reading a url() back returns an absolutized URL rather
		// than the author's string, whichever way it was written - including a
		// <style> element's own textContent, which CSS-in-JS libraries read back
		// to dedupe and patch rules. Mildest of the group in that it stays on the
		// site's own origin.
		name: "cssurls-author-string-preserved",
		js: `
			const a = document.createElement("div");
			a.style.backgroundImage = "url(/bg.png)";
			assertEqual(a.style.backgroundImage, 'url("/bg.png")', "after a CSSOM write");
			const b = document.createElement("div");
			b.setAttribute("style", "background-image: url(/bg.png)");
			assertEqual(b.style.backgroundImage, 'url("/bg.png")', "after a setAttribute write");
			const c = document.createElement("div");
			c.innerHTML = '<div style="background-image: url(/bg.png)"></div>';
			assertEqual(c.firstChild.style.backgroundImage, 'url("/bg.png")', "after parsing markup");
			const st = document.createElement("style");
			st.textContent = ".a { background-image: url(/x.png); }";
			document.head.appendChild(st);
			assertEqual(st.textContent, ".a { background-image: url(/x.png); }", "style textContent round trip");
		`,
	}),
];

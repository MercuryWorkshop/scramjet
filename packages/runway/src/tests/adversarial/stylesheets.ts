import { serverTest } from "../../testcommon.ts";

// Stylesheet loading end to end, plus the CSSOM views onto it: document
// .styleSheets, @import chains, constructable stylesheets (what every
// web-component library uses), FontFace and custom properties.
//
// tests/rewriter-css.ts covers the CSS rewriter itself; this covers what a page
// can observe after a sheet has actually loaded and applied.

const FILES: Record<string, string> = {
	"/s.css": `@import "/imported.css";\n.styled { color: rgb(1, 2, 3); background-image: url(/bg.png); }`,
	"/imported.css": `.imported { color: rgb(4, 5, 6); }`,
};

const cssTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (FILES[path]) {
					res.writeHead(200, { "Content-Type": "text/css" });
					res.end(FILES[path]);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("nf");
			});
		},
	});

const LINK = `
	const addSheet = async () => {
		const l = document.createElement("link");
		l.rel = "stylesheet";
		l.href = "/s.css";
		await new Promise((res, rej) => { l.onload = res; l.onerror = () => rej(new Error("stylesheet failed to load")); document.head.appendChild(l); });
		return l;
	};
`;

export default [
	cssTest(
		"stylesheets-link-applies",
		`
			${LINK}
			await addSheet();
			const d = document.createElement("div");
			d.className = "styled";
			document.body.appendChild(d);
			assertEqual(getComputedStyle(d).color, "rgb(1, 2, 3)", "the linked stylesheet applied");
			const i = document.createElement("div");
			i.className = "imported";
			document.body.appendChild(i);
			assertEqual(getComputedStyle(i).color, "rgb(4, 5, 6)", "@import inside it applied too");
		`
	),
	cssTest(
		"stylesheets-link-element-urls",
		`
			${LINK}
			const l = await addSheet();
			assertEqual(l.href, location.origin + "/s.css", "link.href property");
			assertEqual(l.getAttribute("href"), "/s.css", "the href attribute keeps the literal value");
			assertEqual(l.outerHTML, '<link rel="stylesheet" href="/s.css">', "outerHTML");
			const sheet = [...document.styleSheets].find((s) => (s.href || "").includes("s.css"));
			assert(sheet, "the sheet appears in document.styleSheets");
			assert(sheet.cssRules.length >= 1, "cssRules are readable");
		`
	),
	cssTest(
		"stylesheets-constructable-applies",
		`
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(".ctor { color: rgb(7, 8, 9); }");
			document.adoptedStyleSheets = [sheet];
			const d = document.createElement("div");
			d.className = "ctor";
			document.body.appendChild(d);
			assertEqual(getComputedStyle(d).color, "rgb(7, 8, 9)", "a constructable stylesheet applied");
			assertEqual(sheet.cssRules.length, 1, "cssRules");
			await sheet.replace(".ctor { color: rgb(9, 9, 9); }");
			assertEqual(getComputedStyle(d).color, "rgb(9, 9, 9)", "replace() updates it");
		`
	),
	cssTest(
		"stylesheets-adopted-in-shadow-root",
		`
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(".sh { color: rgb(10, 11, 12); }");
			const host = document.createElement("div");
			document.body.appendChild(host);
			const root = host.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [sheet];
			const d = document.createElement("div");
			d.className = "sh";
			root.appendChild(d);
			assertEqual(getComputedStyle(d).color, "rgb(10, 11, 12)", "adoptedStyleSheets in a shadow root");
		`
	),
	cssTest(
		"stylesheets-fontface",
		`
			const ff = new FontFace("probefont", "url(/font.woff2)");
			document.fonts.add(ff);
			assertEqual(ff.family, "probefont", "FontFace.family");
			assertEqual(typeof document.fonts.check("12px probefont"), "boolean", "document.fonts.check");
			const d = document.createElement("div");
			d.style.fontFamily = "probefont";
			document.body.appendChild(d);
			assertEqual(getComputedStyle(d).fontFamily, "probefont", "font-family round trip");
			assertEqual(typeof document.fonts.ready, "object", "document.fonts.ready");
		`
	),
	cssTest(
		"stylesheets-custom-properties",
		`
			const d = document.createElement("div");
			d.style.setProperty("--probe-var", "42px");
			d.style.width = "var(--probe-var)";
			document.body.appendChild(d);
			assertEqual(d.style.getPropertyValue("--probe-var"), "42px", "custom property round trip");
			assertEqual(getComputedStyle(d).getPropertyValue("--probe-var").trim(), "42px", "computed custom property");
			assertEqual(getComputedStyle(d).width, "42px", "var() resolved");
			assertEqual(d.getAttribute("style"), "--probe-var: 42px; width: var(--probe-var);", "style attribute");
		`
	),

	// ------------------------------------------------------------------
	cssTest(
		// KNOWN FAILURE: styleSheets[].href is the full proxy URL even though
		// link.href is correct. Font loaders, CSS-in-JS runtimes and "have I
		// already injected this sheet" checks all read it.
		"stylesheets-document-stylesheets-href",
		`
			${LINK}
			await addSheet();
			const sheet = [...document.styleSheets].find((s) => (s.href || "").includes("s.css"));
			assert(sheet, "the sheet is present");
			assert(!sheet.href.includes("/~/sj/"), "styleSheets[].href must not expose the proxy URL: " + sheet.href);
			assertEqual(sheet.href, location.origin + "/s.css", "styleSheets[].href");
			const imported = [...sheet.cssRules].find((r) => r.type === CSSRule.IMPORT_RULE);
			if (imported) {
				assert(!imported.href.includes("/~/sj/"), "@import rule href leaks: " + imported.href);
				assert(!imported.styleSheet.href.includes("/~/sj/"),
					"the imported sheet's href leaks: " + imported.styleSheet.href);
			}
		`
	),
	cssTest(
		// KNOWN FAILURE: a url() written through a constructable stylesheet is
		// rewritten going in (it loads) but not un-rewritten coming back out, so
		// the computed value is the proxy URL. This is the path every
		// web-component library takes (Lit's static styles / adoptedStyleSheets).
		"stylesheets-constructable-url-readback",
		`
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(".ctorbg { background-image: url(/cbg.png); }");
			document.adoptedStyleSheets = [sheet];
			const d = document.createElement("div");
			d.className = "ctorbg";
			document.body.appendChild(d);
			const bg = getComputedStyle(d).backgroundImage;
			assert(!bg.includes("/~/sj/"), "the computed background must not expose the proxy URL: " + bg);
			assertEqual(bg, 'url("' + location.origin + '/cbg.png")', "computed background");
			assert(!sheet.cssRules[0].cssText.includes("/~/sj/"), "cssText leaks: " + sheet.cssRules[0].cssText);
		`
	),
];

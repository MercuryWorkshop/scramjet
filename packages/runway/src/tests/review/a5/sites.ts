import { playwrightTest } from "../../../testcommon.ts";

// Real sites heavy on workers / storage / wasm. Each logs the page errors and
// a small functional probe; compare main vs develop output.

const site = (name: string, url: string, probe: string, waitMs = 12000) =>
	playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) =>
				errs.push("pageerror: " + String(e.message).slice(0, 200))
			);
			page.on("console", (m) => {
				if (m.type() === "error")
					errs.push("console: " + m.text().slice(0, 200));
			});
			await navigate(url);
			await new Promise((r) => setTimeout(r, waitMs));
			const host = new URL(url).hostname;
			const fr = page.frames().find((f) => f.url().includes(host));
			let res: any = "no frame";
			if (fr) {
				try {
					res = await fr.evaluate(probe);
				} catch (e) {
					res = "probe threw: " + String(e);
				}
			}
			console.log("SITE " + name + " RESULT " + JSON.stringify(res));
			console.log(
				"SITE " + name + " ERRORS " + JSON.stringify(errs.slice(0, 25))
			);
		},
	});

export default [
	site(
		"rv5-site-monaco",
		"https://microsoft.github.io/monaco-editor/playground.html",
		`(() => ({ editors: document.querySelectorAll(".monaco-editor").length, ls: Object.keys(localStorage).length }))()`
	),
	site(
		"rv5-site-pdfjs",
		"https://mozilla.github.io/pdf.js/web/viewer.html",
		`(() => ({ pages: document.querySelectorAll(".page").length, text: document.querySelectorAll(".textLayer span").length }))()`,
		15000
	),
	site(
		"rv5-site-squoosh",
		"https://squoosh.app/",
		`(() => ({ title: document.title, body: document.body.innerText.slice(0, 80) }))()`
	),
	site(
		"rv5-site-excalidraw",
		"https://excalidraw.com/",
		`(() => ({ canvas: document.querySelectorAll("canvas").length, ls: Object.keys(localStorage) }))()`
	),
	site(
		"rv5-site-photopea",
		"https://www.photopea.com/",
		`(() => ({ title: document.title, canvases: document.querySelectorAll("canvas").length }))()`,
		20000
	),
	site(
		"rv5-site-sqlite-wasm",
		"https://sqlite.org/fiddle/",
		`(() => ({ out: (document.querySelector("#output") || {}).value?.slice(0, 300) || document.body.innerText.slice(0, 300) }))()`,
		15000
	),
];

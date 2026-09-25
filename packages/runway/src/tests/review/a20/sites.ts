import { playwrightTest } from "../../../testcommon.ts";

// rv20: real worker-heavy sites through the proxy. Prints RV20SITE lines.

const site = (
	name: string,
	url: string,
	probe: string,
	act?: string,
	waitMs = 15000
) =>
	Object.assign(
		playwrightTest({
			name,
			fn: async ({ page, navigate }) => {
				const errs: string[] = [];
				const workers: string[] = [];
				let unrw = 0,
					unrwWorker = 0;
				page.on("pageerror", (e) =>
					errs.push("pageerror: " + String(e.message).slice(0, 200))
				);
				page.on("console", (m) => {
					if (/unrewriteurl: unexpected url/.test(m.text())) unrw++;
					if (
						m.type() === "error" &&
						!/unrewriteurl: unexpected url/.test(m.text())
					)
						errs.push(
							"console: " + m.text().replace(/\s+/g, " ").slice(0, 200)
						);
				});
				page.on("worker", (w) => {
					workers.push(
						decodeURIComponent(w.url())
							.replace(/^.*\/~\/sj\/[^/]+\/[^/]+\//, "")
							.replace(/\?\$top.*$/, "")
							.slice(0, 120)
					);
					w.on("console", (m) => {
						if (/unrewriteurl/.test(m.text())) unrwWorker++;
						if (m.type() === "error" && !/unrewriteurl/.test(m.text()))
							errs.push(
								"worker console: " + m.text().replace(/\s+/g, " ").slice(0, 200)
							);
					});
				});
				page.on("response", (r) => {
					if (r.status() >= 400 && r.url().includes("/~/sj/"))
						errs.push(
							"http " +
								r.status() +
								" " +
								decodeURIComponent(r.url())
									.replace(/\?\$top.*$/, "")
									.slice(0, 200)
						);
				});
				await navigate(url);
				await new Promise((r) => setTimeout(r, waitMs));
				const host = new URL(url).hostname;
				const fr = page
					.frames()
					.find(
						(f) =>
							f.url().includes(encodeURIComponent(host)) ||
							f.url().includes(host)
					);
				let res: any = "no frame";
				if (fr) {
					if (act) {
						try {
							await fr.evaluate(act);
						} catch (e) {
							errs.push("act threw: " + String(e).slice(0, 120));
						}
						await new Promise((r) => setTimeout(r, 6000));
					}
					try {
						res = await fr.evaluate(probe);
					} catch (e) {
						res = "probe threw: " + String(e).slice(0, 160);
					}
				}
				console.log("RV20SITE " + name + " RESULT " + JSON.stringify(res));
				console.log("RV20SITE " + name + " WORKERS " + JSON.stringify(workers));
				console.log(
					"RV20SITE " +
						name +
						" UNREWRITE page=" +
						unrw +
						" worker=" +
						unrwWorker
				);
				console.log(
					"RV20SITE " +
						name +
						" ERRORS " +
						errs.length +
						" " +
						JSON.stringify(errs.slice(0, 25))
				);
			},
		}),
		{
			timeoutMs: 90000,
		}
	);

export default [
	site(
		"rv20-site-sqljs",
		"https://sql.js.org/examples/GUI/index.html",
		`(() => ({ tables: document.querySelectorAll("#output table").length, rows: document.querySelectorAll("#output tr").length, err: (document.querySelector("#error") || {}).textContent }))()`,
		`document.querySelector("#execute").click()`
	),
	site(
		"rv20-site-pdfjs",
		"https://mozilla.github.io/pdf.js/web/viewer.html",
		`(() => ({ pages: document.querySelectorAll("#viewer .page").length, text: document.querySelectorAll(".textLayer span").length, canv: document.querySelectorAll("#viewer canvas").length, err: (document.querySelector("#errorWrapper:not([hidden])") || {}).textContent }))()`
	),
	site(
		"rv20-site-monaco",
		"https://microsoft.github.io/monaco-editor/playground.html",
		`(() => ({ editors: document.querySelectorAll(".monaco-editor").length, lines: document.querySelectorAll(".view-line").length, squiggles: document.querySelectorAll(".squiggly-error,.squiggly-warning").length }))()`
	),
	site(
		"rv20-site-prettier",
		"https://prettier.io/playground/#N4Igxg9gdgLgprEAuEBDANgAgOYFcC2mAvJgEqqwBOlaAPAIwAMjAfADpSaa0BmAhgA8AFEICUAbg4gANCAgAHGAEt0yUCSEAjAIYBzHFt0Au3Z0D9yyAgAvMSwBGQ",
		`(() => ({ panes: document.querySelectorAll(".CodeMirror").length, out: [...document.querySelectorAll(".CodeMirror")].map((c) => c.CodeMirror ? c.CodeMirror.getValue().slice(0, 60) : c.textContent.slice(0, 60)) }))()`
	),
	site(
		"rv20-site-babel",
		"https://babeljs.io/repl#?code_lz=MYewdgzgLgBAhgLhgXhgcgGYgE5piAQwEMYBvAMwgB9MA&presets=env",
		`(() => ({ out: (document.querySelectorAll(".cm-content")[1] || document.body).textContent.slice(0, 120) }))()`
	),
	site(
		"rv20-site-regex101",
		"https://regex101.com/r/cO8lqs/1",
		`(() => ({ text: (document.querySelector("[data-testid='match-info'],.match-info,.matchinfo") || { textContent: document.body.innerText.slice(0, 0) }).textContent.slice(0, 80), body: /match/i.test(document.body.innerText) }))()`
	),
	site(
		"rv20-site-tsplay",
		"https://www.typescriptlang.org/play/?#code/MYewdgzgLgBAhgLhgXhgcgGYgE5piAQwEMYBvAMwgB9MA",
		`(() => ({ editors: document.querySelectorAll(".monaco-editor").length, squiggles: document.querySelectorAll(".squiggly-error").length, js: (document.querySelector(".playground-sidebar .monaco-editor .view-lines") || {}).textContent }))()`
	),
	site(
		"rv20-site-excalidraw",
		"https://excalidraw.com/",
		`(() => ({ canv: document.querySelectorAll("canvas").length, app: !!document.querySelector(".excalidraw") }))()`
	),
];

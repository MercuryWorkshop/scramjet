import { playwrightTest } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv5-dbg-monaco",
		fn: async ({ page, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) =>
				errs.push("pageerror: " + String(e.stack || e.message).slice(0, 1500))
			);
			page.on("console", (m) => {
				if (m.type() === "error" || m.type() === "warning")
					errs.push("console[" + m.type() + "]: " + m.text().slice(0, 1500));
			});
			page.on("worker", (w) => errs.push("worker: " + w.url().slice(0, 200)));
			await navigate(
				"https://microsoft.github.io/monaco-editor/playground.html"
			);
			await new Promise((r) => setTimeout(r, 12000));
			console.log("DBG " + errs.join("\n----\n"));
		},
	}),
];

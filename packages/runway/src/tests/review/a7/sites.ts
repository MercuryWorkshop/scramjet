import { playwrightTest } from "../../../testcommon.ts";

// Loads real sites through the proxy and dumps page errors + a few DOM facts,
// so main and develop can be compared.
const sites = [
	["react", "https://react.dev/"],
	["mui", "https://mui.com/material-ui/getting-started/"],
	["styledc", "https://styled-components.com/"],
	["tailwind", "https://tailwindcss.com/"],
	["angular", "https://angular.dev/"],
	["vue", "https://vuejs.org/"],
	["svelte", "https://svelte.dev/"],
	["github", "https://github.com/HeyPuter/browser.js"],
	["wiki", "https://en.wikipedia.org/wiki/Cascading_Style_Sheets"],
	["nextjs", "https://nextjs.org/"],
];

export default sites.map(([name, url]) =>
	playwrightTest({
		name: `rv7-site-${name}`,
		fn: async ({ page, frame, navigate }) => {
			const errors: string[] = [];
			const onErr = (e: Error) =>
				errors.push("pageerror: " + String(e.message).slice(0, 200));
			const onCon = (m: any) => {
				if (m.type() === "error")
					errors.push("console: " + m.text().slice(0, 200));
			};
			page.on("pageerror", onErr);
			page.on("console", onCon);
			try {
				await navigate(url);
				await new Promise((r) => setTimeout(r, 9000));
				const facts = await frame.locator("body").evaluate(() => {
					const sheets = [...document.styleSheets].length;
					let rules = 0;
					for (const s of document.styleSheets) {
						try {
							rules += s.cssRules.length;
						} catch {}
					}
					const proxied = [...document.querySelectorAll("[style]")].filter(
						(e) => (e.getAttribute("style") || "").includes("/~/sj/")
					).length;
					return {
						title: document.title,
						sheets,
						rules,
						adopted: document.adoptedStyleSheets.length,
						proxied,
						h: document.body.scrollHeight,
						path: location.pathname,
					};
				});
				console.log(
					`RV7SITE ${name} ` +
						JSON.stringify({
							facts,
							errors: errors.slice(0, 25),
							nerr: errors.length,
						})
				);
			} finally {
				page.off("pageerror", onErr);
				page.off("console", onCon);
			}
		},
	})
);

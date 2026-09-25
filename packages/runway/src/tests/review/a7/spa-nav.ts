import { playwrightTest } from "../../../testcommon.ts";

const cases: [string, string, string][] = [
	["react", "https://react.dev/", "a[href='/learn']"],
	["vue", "https://vuejs.org/", "a[href='/guide/introduction']"],
	["angular", "https://angular.dev/", "a[href='/overview']"],
	["svelte", "https://svelte.dev/", "a[href='/docs']"],
];

export default cases.map(([name, url, sel]) =>
	Object.assign(
		playwrightTest({
			name: `rv7-spa-${name}`,
			fn: async ({ page, frame, navigate }) => {
				const errors: string[] = [];
				const onErr = (e: Error) =>
					errors.push(String(e.message).slice(0, 200));
				page.on("pageerror", onErr);
				try {
					await navigate(url);
					await frame.locator("body").waitFor({
						state: "attached",
						timeout: 30000,
					});
					let clicked = false;
					for (let i = 0; i < 20 && !clicked; i++) {
						await new Promise((r) => setTimeout(r, 1000));
						clicked = await frame.locator("body").evaluate((_b, sel) => {
							const a = document.querySelector(sel) as HTMLElement | null;
							if (!a) return false;
							a.click();
							return true;
						}, sel);
					}
					if (!clicked) throw new Error("link not found");
					await new Promise((r) => setTimeout(r, 4000));
					const info = await frame.locator("body").evaluate(() => ({
						path: location.pathname,
						href: location.href,
						title: document.title,
						hl: history.length,
						state: (() => {
							try {
								return JSON.stringify(history.state).slice(0, 80);
							} catch {
								return "?";
							}
						})(),
					}));
					console.log(
						`RV7SPA ${name} ` +
							JSON.stringify({
								info,
								errors,
							})
					);
					if (info.path === new URL(url).pathname)
						throw new Error("did not navigate: " + JSON.stringify(info));
				} finally {
					page.off("pageerror", onErr);
				}
			},
		}),
		{
			timeoutMs: 90000,
		}
	)
);

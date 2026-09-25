// rv23: MediaWiki "module already implemented" after a second page load in the same session
import { playwrightTest } from "../../../testcommon.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mk = (name: string, how: "navigate" | "click" | "reload") =>
	playwrightTest({
		name,
		fn: async ({ page, frame, navigate }) => {
			const errs: string[] = [];
			const on = (e: Error) => errs.push(e.message.slice(0, 80));
			page.on("pageerror", on);
			try {
				await navigate("https://en.wikipedia.org/wiki/Web_browser");
				await frame.locator("#firstHeading").waitFor({
					timeout: 30000,
				});
				await sleep(6000);
				const first = errs.length;
				if (how === "navigate")
					await navigate("https://en.wikipedia.org/wiki/Application_software");
				else if (how === "reload")
					await frame.locator("body").evaluate(() => location.reload());
				else
					await frame
						.locator("body")
						.evaluate(() =>
							(
								document.querySelector(
									"#mw-content-text p a[href*='/wiki/']"
								) as HTMLAnchorElement
							).click()
						);
				await sleep(8000);
				const store = await frame.locator("body").evaluate(() => {
					const k = Object.keys(localStorage).filter((x) =>
						/ModuleStore/.test(x)
					);
					return k.map((x) => x + ":" + (localStorage.getItem(x)?.length ?? 0));
				});
				if (errs.length)
					throw new Error(
						`first load ${first} errors, after ${how} ${errs.length - first}: ${[...new Set(errs)].slice(0, 4).join(" | ")}; store=${store}`
					);
			} finally {
				page.off("pageerror", on);
			}
		},
	});

export default [
	mk("rv23-wiki-second-load-navigate", "navigate"),
	mk("rv23-wiki-second-load-click", "click"),
	mk("rv23-wiki-second-load-reload", "reload"),
];

import { playwrightTest } from "../../../testcommon.ts";

const text = async (frame: any) =>
	(await frame.locator("body").textContent({
		timeout: 20000,
	})) || "";

export default [
	playwrightTest({
		name: "rv4-navsite-wikipedia-search-and-link",
		fn: async ({ page, frame, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
			await navigate("https://en.wikipedia.org/wiki/Main_Page");
			const input = frame.locator("input[name=search]").first();
			await input.waitFor({
				timeout: 20000,
			});
			await input.fill("Alan Turing");
			await input.press("Enter");
			await frame
				.locator("h1#firstHeading")
				.filter({
					hasText: "Alan Turing",
				})
				.waitFor({
					timeout: 20000,
				});
			await frame.locator("a[title='Enigma machine']").first().click();
			await frame
				.locator("h1#firstHeading")
				.filter({
					hasText: "Enigma machine",
				})
				.waitFor({
					timeout: 20000,
				});
			await frame.locator("body").evaluate(() => history.back());
			await frame
				.locator("h1#firstHeading")
				.filter({
					hasText: "Alan Turing",
				})
				.waitFor({
					timeout: 20000,
				});
		},
	}),
	playwrightTest({
		name: "rv4-navsite-ddg-html-post",
		fn: async ({ page, frame, navigate }) => {
			await navigate("https://html.duckduckgo.com/html/");
			const input = frame.locator("input[name=q]").first();
			await input.waitFor({
				timeout: 20000,
			});
			await input.fill("scramjet proxy");
			await input.press("Enter");
			try {
				await frame.locator(".result__a, .result").first().waitFor({
					timeout: 20000,
				});
			} catch {
				throw new Error(
					"ddg: " + (await text(frame).catch((e) => String(e))).slice(0, 300)
				);
			}
		},
	}),
	playwrightTest({
		name: "rv4-navsite-httpbin-forms",
		fn: async ({ frame, navigate }) => {
			await navigate("https://httpbin.org/forms/post");
			await frame.locator("input[name=custname]").fill("Bob");
			await frame.locator("input[name=size][value=medium]").check();
			await frame.locator("button").first().click();
			const t = await (async () => {
				for (let i = 0; i < 40; i++) {
					const s = await text(frame).catch(() => "");
					if (s.includes("custname")) return s;
					await new Promise((r) => setTimeout(r, 500));
				}
				return "";
			})();
			if (!t.includes('"custname": "Bob"') || !t.includes('"size": "medium"'))
				throw new Error("form post result " + t.slice(0, 400));
		},
	}),
	playwrightTest({
		name: "rv4-navsite-httpbin-redirect-cookies",
		fn: async ({ frame, navigate }) => {
			await navigate("https://httpbin.org/cookies/set?rv4a=1&rv4b=2");
			const t = await (async () => {
				for (let i = 0; i < 40; i++) {
					const s = await text(frame).catch(() => "");
					if (s.includes("cookies")) return s;
					await new Promise((r) => setTimeout(r, 500));
				}
				return "";
			})();
			if (!t.includes('"rv4a": "1"'))
				throw new Error("cookies after redirect " + t.slice(0, 300));
		},
	}),
];

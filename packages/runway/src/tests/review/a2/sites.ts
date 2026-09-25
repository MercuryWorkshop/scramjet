import { playwrightTest } from "../../../testcommon.ts";

const sites = [
	["wikipedia", "https://en.wikipedia.org/wiki/Web_browser"],
	["hn", "https://news.ycombinator.com/"],
	["github", "https://github.com/facebook/react"],
	["reddit", "https://www.reddit.com/r/programming/"],
	["discord", "https://discord.com/login"],
	["stackoverflow", "https://stackoverflow.com/questions"],
	["bbc", "https://www.bbc.com/news"],
	["npm", "https://www.npmjs.com/package/react"],
	[
		"mdn",
		"https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute",
	],
	["twitch", "https://www.twitch.tv/"],
	["youtube", "https://www.youtube.com/"],
	["google", "https://www.google.com/search?q=scramjet"],
];

export default sites.map(([name, url]) =>
	playwrightTest({
		name: `rv2-site-${name}`,
		fn: async ({ page, frame, navigate }) => {
			const errors: string[] = [];
			page.on("pageerror", (e) =>
				errors.push("PAGEERROR " + String(e.message).slice(0, 200))
			);
			page.on("console", (m) => {
				if (m.type() === "error")
					errors.push("CONSOLE " + m.text().slice(0, 200));
			});
			await navigate(url);
			await new Promise((r) => setTimeout(r, 12000));
			let info = "";
			try {
				info = await frame.locator("body").evaluate((b: HTMLElement) => {
					const d = b.ownerDocument;
					return `title=${d.title.slice(0, 60)} els=${d.getElementsByTagName("*").length} imgs=${d.images.length} links=${d.links.length} text=${(b.innerText || "").length}`;
				});
			} catch (e) {
				info = "EVAL FAILED " + String(e).slice(0, 200);
			}
			const uniq = [...new Set(errors)];
			throw new Error(
				"SITEREPORT " + info + "\n" + uniq.slice(0, 40).join("\n")
			);
		},
	})
);

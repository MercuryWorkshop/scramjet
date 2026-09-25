import { playwrightTest } from "../../../testcommon.ts";

// Load real sites and dump page errors / console errors that look rewriter-related.
const sites = [
	"https://www.youtube.com/",
	"https://discord.com/login",
	"https://www.google.com/search?q=scramjet",
	"https://github.com/",
	"https://www.reddit.com/",
	"https://en.wikipedia.org/wiki/JavaScript",
	"https://www.twitch.tv/",
	"https://x.com/",
	"https://www.nytimes.com/",
	"https://stackoverflow.com/questions",
];

export default sites.map((url, i) =>
	playwrightTest({
		name: `rv8-site-${i}-${new URL(url).hostname}`,
		fn: async ({ page, navigate }) => {
			const errs: string[] = [];
			const onErr = (e: Error) => errs.push("pageerror: " + e.message);
			const onConsole = (m: any) => {
				if (m.type() === "error")
					errs.push("console: " + m.text().slice(0, 300));
			};
			page.on("pageerror", onErr);
			page.on("console", onConsole);
			try {
				await navigate(url);
			} catch (e) {
				errs.push("navigate: " + (e as Error).message);
			}
			await new Promise((r) => setTimeout(r, 12000));
			page.off("pageerror", onErr);
			page.off("console", onConsole);
			const interesting = process.env.RV8_ALL
				? errs
				: errs.filter((e) =>
						/scramjet|registerrealm|pushsourcemap|SyntaxError|is not defined|is not a function|Unexpected|tempreceiver|wrapPostMessage/i.test(
							e
						)
					);
			const fs = await import("node:fs");
			fs.appendFileSync(
				"/home/velzie/.cache/sjreview/scratch-a8/sites-" +
					(process.cwd().includes("/dev/") ? "dev" : "main") +
					".log",
				`=== ${url}\n${interesting.join("\n")}\n(total errors ${errs.length})\n`
			);
		},
	})
);

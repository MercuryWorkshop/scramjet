import { playwrightTest } from "../../../testcommon.ts";

const dbg = (name: string, url: string, wait = 20000, filter = /./) =>
	playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const out: string[] = [];
			page.on("pageerror", (e: any) =>
				out.push("PE " + e.message + "\n   " + String(e.stack).slice(0, 600))
			);
			page.on("console", (m: any) => {
				if (m.type() === "error" && filter.test(m.text()))
					out.push("CE " + m.text().slice(0, 1200));
			});
			page.on("requestfailed", (r: any) => {
				if (filter.test(r.url()))
					out.push(
						"RF " +
							decodeURIComponent(r.url()).slice(0, 300) +
							" " +
							r.failure()?.errorText
					);
			});
			page.on("response", (r: any) => {
				if (filter.test(r.url()))
					out.push(
						"RS " +
							r.status() +
							" " +
							decodeURIComponent(r.url())
								.replace(/^.*?\/~\/sj\/[^/]+\/[^/]+\//, "")
								.slice(0, 400)
					);
			});
			page.on("response", async (r: any) => {
				if (/v2\.10%2Fbundle\.js/.test(r.url())) {
					try {
						const t = await r.text();
						const i = t.indexOf("C8PzrStM2");
						out.push(
							"BUNDLE " +
								r.url().slice(0, 60) +
								" len=" +
								t.length +
								" ctx=" +
								t.slice(Math.max(0, i - 300), i + 60)
						);
						out.push("HEAD " + t.slice(0, 300));
					} catch (e) {
						out.push("BUNDLE err " + e);
					}
				}
			});
			page.on("response", async (r: any) => {
				if (/games\.crazygames\.com%2Fen_US/.test(r.url())) {
					try {
						const t = await r.text();
						const i = t.indexOf("importmap");
						out.push(
							"IMRAW " + (i < 0 ? "none in html" : t.slice(i - 50, i + 900))
						);
						const j = t.indexOf("gameframe/v");
						out.push("GFREF " + t.slice(Math.max(0, j - 300), j + 200));
					} catch (e) {
						out.push("IMRAW err " + e);
					}
				}
			});
			page.on("frameattached", (f: any) => out.push("FA"));
			page.on("framenavigated", (f: any) => {
				if (f.url().includes("crazygames"))
					out.push(
						"FN " +
							decodeURIComponent(f.url())
								.replace(/^.*?\/~\/sj\/[^/]+\/[^/]+\//, "")
								.slice(0, 300)
					);
			});
			await navigate(url);
			await new Promise((r) => setTimeout(r, wait));
			for (const f of page.frames()) {
				if (!decodeURIComponent(f.url()).includes("games.crazygames.com/en_US"))
					continue;
				const r = await f
					.evaluate(
						`(async () => {
					const maps = [...document.querySelectorAll("script")].filter(s => /importmap/i.test(s.type)).map(s => s.textContent.slice(0, 400));
					let res; try { const m = await $scramjet$import("https://builds.crazygames.com/gameframe/v2.10/bundle.js", "./static/js/C8PzrStM2.js"); res = "ok " + Object.keys(m).length; } catch (e) { res = "err " + String(e).slice(0, 300); }
					return { maps, res, base: document.baseURI, href: location.href };
				})()`
					)
					.catch((e: any) => "eval threw " + e);
				out.push("EVAL " + JSON.stringify(r));
			}
			console.log("GDBG " + name + "\n" + out.join("\n"));
		},
	});

export default [
	dbg(
		"rv5-gdbg-crazygames",
		"https://www.crazygames.com/game/bloxdhop-io",
		25000,
		/builds\.crazygames|games\.crazygames/i
	),
];

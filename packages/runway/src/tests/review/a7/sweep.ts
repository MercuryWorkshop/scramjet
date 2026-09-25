import { playwrightTest } from "../../../testcommon.ts";

const BUILD = import.meta.url.includes("/sjreview/dev/") ? "dev" : "main";
const SHOTS = `/home/velzie/.cache/sjreview/scratch-a7/shots/${BUILD}/`;

// [name, url, key selector (optional), interaction]
type Site = [string, string, string?, string?];
const sites: Site[] = [
	["baidu", "https://www.baidu.com/", "#kw", "search:#kw:scramjet"],
	["yandex", "https://yandex.ru/", "body", "scroll"],
	["naver", "https://www.naver.com/", "body", "scroll"],
	["bilibili", "https://www.bilibili.com/", "body", "scroll"],
	["weibo", "https://weibo.com/", "body", "scroll"],
	["qq", "https://www.qq.com/", "body", "scroll"],
	["rakuten", "https://www.rakuten.co.jp/", "body", "scroll"],
	["yahoojp", "https://www.yahoo.co.jp/", "body", "scroll"],
	["mercadolibre", "https://www.mercadolibre.com/", "body", "click:a"],
	["globo", "https://www.globo.com/", "body", "scroll"],
	["spiegel", "https://www.spiegel.de/", "body", "scroll"],
	["lemonde", "https://www.lemonde.fr/", "body", "scroll"],
	["zhihu", "https://www.zhihu.com/", "body", "scroll"],
	[
		"hn",
		"https://news.ycombinator.com/",
		"a.storylink, .titleline a",
		"click:.titleline a",
	],
	["lobsters", "https://lobste.rs/", ".story", "click:a.u-url"],
	["discourse", "https://meta.discourse.org/", ".topic-list", "click:a.title"],
	["phpbb", "https://www.phpbb.com/community/", "body", "click:a.forumtitle"],
	[
		"wikimobile",
		"https://en.m.wikipedia.org/wiki/Web_browser",
		"#content",
		"click:#mw-mf-main-menu-button",
	],
	[
		"fandom",
		"https://minecraft.fandom.com/wiki/Minecraft_Wiki",
		"body",
		"scroll",
	],
	["wordpress", "https://wordpress.com/", "body", "scroll"],
	["ghost", "https://ghost.org/blog/", "body", "click:article a"],
	["medium", "https://medium.com/", "body", "scroll"],
	["substack", "https://substack.com/", "body", "scroll"],
	["devto", "https://dev.to/", "body", "search:input[name=q]:javascript"],
	["quora", "https://www.quora.com/", "body", "scroll"],
	["pydocs", "https://docs.python.org/3/", "body", "search:input[name=q]:list"],
	["docusaurus", "https://docusaurus.io/", "body", "click:a.navbar__link"],
	["gitbook", "https://docs.gitbook.com/", "body", "scroll"],
	["tsplay", "https://www.typescriptlang.org/play", "body", "scroll"],
	["jsfiddle", "https://jsfiddle.net/", "body", "scroll"],
	["regex101", "https://regex101.com/", "body", "scroll"],
	["godbolt", "https://godbolt.org/", "body", "scroll"],
	["observable", "https://observablehq.com/", "body", "scroll"],
	["kaggle", "https://www.kaggle.com/", "body", "scroll"],
	["bsky", "https://bsky.app/", "body", "scroll"],
	["mastodon", "https://mastodon.social/explore", "body", "scroll"],
	["threads", "https://www.threads.net/", "body", "scroll"],
	["tumblr", "https://www.tumblr.com/explore", "body", "scroll"],
	["allbirds", "https://www.allbirds.com/", "body", "scroll"],
	["etsy", "https://www.etsy.com/", "body", "scroll"],
	["ikea", "https://www.ikea.com/us/en/", "body", "scroll"],
	["booking", "https://www.booking.com/", "body", "scroll"],
	["airbnb", "https://www.airbnb.com/", "body", "scroll"],
	["craigslist", "https://sfbay.craigslist.org/", "body", "click:a"],
	["osm", "https://www.openstreetmap.org/", "#map", "scroll"],
	["khan", "https://www.khanacademy.org/", "body", "scroll"],
	["duolingo", "https://www.duolingo.com/", "body", "scroll"],
	["outlook", "https://outlook.live.com/owa/", "body", "scroll"],
	["proton", "https://proton.me/", "body", "scroll"],
	[
		"wayback",
		"https://web.archive.org/web/20100101000000*/example.com",
		"body",
		"scroll",
	],
	[
		"waybacksnap",
		"https://web.archive.org/web/2015/https://www.google.com/",
		"body",
		"scroll",
	],
	["archive", "https://archive.org/", "body", "scroll"],
];

export default sites.map(([name, url, sel, act]) =>
	Object.assign(
		playwrightTest({
			name: `rv7-sweep-${name}`,
			fn: async ({ page, frame, navigate }) => {
				const errors: string[] = [];
				const consoleErr: string[] = [];
				const failed: string[] = [];
				const bad: string[] = [];
				const short = (u: string) => {
					try {
						const m = /\/~\/sj\/[^/]+\/[^/]+\/([^?]*)/.exec(u);
						return (m ? decodeURIComponent(m[1]) : u).slice(0, 140);
					} catch {
						return u.slice(0, 140);
					}
				};
				const onErr = (e: Error) =>
					errors.push(String(e.message).split("\n")[0].slice(0, 220));
				const onCon = (m: any) => {
					if (m.type() === "error")
						consoleErr.push(m.text().split("\n")[0].slice(0, 200));
				};
				const onFail = (r: any) =>
					failed.push(short(r.url()) + " :: " + (r.failure()?.errorText || ""));
				const onResp = (r: any) => {
					if (r.status() >= 400) bad.push(r.status() + " " + short(r.url()));
				};
				page.on("pageerror", onErr);
				page.on("console", onCon);
				page.on("requestfailed", onFail);
				page.on("response", onResp);
				const t0 = Date.now();
				let visible = false,
					interaction = "none",
					facts: any = null,
					navErr = "";
				try {
					try {
						await navigate(url);
					} catch (e: any) {
						navErr = String(e.message).slice(0, 200);
					}
					try {
						await frame
							.locator(sel || "body")
							.first()
							.waitFor({
								state: "visible",
								timeout: 20000,
							});
						visible = true;
					} catch {}
					const tVisible = Date.now() - t0;
					await new Promise((r) => setTimeout(r, 4000));
					try {
						const [kind, s, text] = (act || "scroll").split(":");
						if (kind === "scroll") {
							await frame
								.locator("body")
								.evaluate(() =>
									window.scrollTo(0, document.body.scrollHeight / 2)
								);
							interaction = "scrolled";
						} else if (kind === "click") {
							const ok = await frame.locator("body").evaluate((_b, s) => {
								const a = document.querySelector(s) as HTMLElement | null;
								if (!a) return false;
								a.click();
								return true;
							}, s);
							interaction = ok ? "clicked" : "no-target";
						} else if (kind === "search") {
							const ok = await frame.locator("body").evaluate(
								(_b, [s, t]) => {
									const i = document.querySelector(
										s
									) as HTMLInputElement | null;
									if (!i) return false;
									i.focus();
									i.value = t;
									i.dispatchEvent(
										new Event("input", {
											bubbles: true,
										})
									);
									const f = i.form;
									if (f) f.requestSubmit ? f.requestSubmit() : f.submit();
									return true;
								},
								[s, text]
							);
							interaction = ok ? "searched" : "no-target";
						}
					} catch (e: any) {
						interaction = "ERR " + String(e.message).slice(0, 100);
					}
					await new Promise((r) => setTimeout(r, 4000));
					try {
						facts = await frame.locator("body").evaluate(() => ({
							title: document.title.slice(0, 60),
							n: document.querySelectorAll("*").length,
							text: (document.body.innerText || "").length,
							path: location.pathname.slice(0, 60),
							host: location.host,
						}));
					} catch (e: any) {
						facts = "ERR " + String(e.message).slice(0, 100);
					}
					try {
						await page.screenshot({
							path: SHOTS + name + ".png",
						});
					} catch {}
					console.log(
						`RV7SWEEP ${name} ` +
							JSON.stringify({
								visible,
								tVisible,
								total: Date.now() - t0,
								interaction,
								facts,
								navErr,
								errors: [...new Set(errors)].slice(0, 15),
								nErr: errors.length,
								consoleErr: [...new Set(consoleErr)].slice(0, 10),
								nCon: consoleErr.length,
								failed: [...new Set(failed)].slice(0, 12),
								nFailed: failed.length,
								bad: [...new Set(bad)].slice(0, 12),
								nBad: bad.length,
							})
					);
				} finally {
					page.off("pageerror", onErr);
					page.off("console", onCon);
					page.off("requestfailed", onFail);
					page.off("response", onResp);
				}
			},
		}),
		{
			timeoutMs: 90000,
			reloadHarness: true,
		}
	)
);

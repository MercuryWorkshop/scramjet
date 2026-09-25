// rv9 real-site regression sweep. Never fails: records a JSON summary per site
// to $SWEEP_OUT/<build>/<site>.json (+ screenshot) so main/develop can be diffed.
// Env: SWEEP_BUILD=main|dev, SWEEP_OUT (default scratch-a9), SWEEP_SITES=a,b (optional)
import { mkdirSync, writeFileSync } from "node:fs";
import type { FrameLocator, Page } from "playwright";
import { playwrightTest } from "../../../testcommon.ts";

const BUILD = process.env.SWEEP_BUILD ?? "unknown";
const OUT = process.env.SWEEP_OUT ?? "/home/velzie/.cache/sjreview/scratch-a9";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Site = {
	name: string;
	url: string;
	sel: string;
	steps?: (f: FrameLocator, page: Page, rec: any) => Promise<void>;
	settle?: number;
};

async function search(
	f: FrameLocator,
	input: string,
	q: string,
	resultSel: string,
	rec: any
) {
	const t0 = Date.now();
	const box = f.locator(input).first();
	await box.click({
		timeout: 15000,
	});
	await box.fill(q, {
		timeout: 15000,
	});
	await box.press("Enter");
	try {
		await f.locator(resultSel).first().waitFor({
			state: "visible",
			timeout: 45000,
		});
		rec.stepOk = true;
	} catch (e) {
		rec.stepOk = false;
		rec.stepError = String(e).slice(0, 300);
	}
	rec.stepMs = Date.now() - t0;
}

const videoState = async (f: FrameLocator, rec: any) => {
	await sleep(10000);
	try {
		rec.video = await f
			.locator("video")
			.first()
			.evaluate((v: HTMLVideoElement) => ({
				paused: v.paused,
				currentTime: v.currentTime,
				readyState: v.readyState,
				error: v.error?.message ?? v.error?.code ?? null,
				srcKind: v.src ? v.src.slice(0, 5) : v.currentSrc.slice(0, 5),
			}));
	} catch (e) {
		rec.video = {
			err: String(e).slice(0, 200),
		};
	}
};

const SITES: Site[] = [
	{
		name: "google",
		url: "https://www.google.com/",
		sel: "textarea[name=q]",
		steps: (f, p, r) =>
			search(f, "textarea[name=q]", "scramjet web proxy", "#search", r),
	},
	{
		name: "youtube-home",
		url: "https://www.youtube.com/",
		sel: "ytd-rich-item-renderer, ytd-masthead",
	},
	{
		name: "youtube-watch",
		url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		sel: "video",
		steps: (f, p, r) => videoState(f, r),
	},
	{
		name: "wikipedia-article",
		url: "https://en.wikipedia.org/wiki/Web_browser",
		sel: "#firstHeading",
	},
	{
		name: "wikipedia-search",
		url: "https://en.wikipedia.org/wiki/Main_Page",
		sel: "input[name=search]",
		steps: (f, p, r) =>
			search(
				f,
				"input[name=search]",
				"proxy server",
				"#firstHeading:has-text('Proxy'), .mw-search-results",
				r
			),
	},
	{
		name: "github-repo",
		url: "https://github.com/MercuryWorkshop/scramjet",
		sel: "article.markdown-body",
	},
	{
		name: "github-file",
		url: "https://github.com/MercuryWorkshop/scramjet/blob/main/package.json",
		sel: "#read-only-cursor-text-area, [data-testid=code-cell], .react-code-lines",
	},
	{
		name: "reddit",
		url: "https://www.reddit.com/r/programming/",
		sel: "shreddit-post",
	},
	{
		name: "x",
		url: "https://x.com/",
		sel: "[data-testid=loginButton], a[href='/login']",
	},
	{
		name: "discord-login",
		url: "https://discord.com/login",
		sel: "input[name=email]",
	},
	{
		name: "stackoverflow",
		url: "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array",
		sel: "#question-header h1",
	},
	{
		name: "amazon",
		url: "https://www.amazon.com/",
		sel: "#nav-logo, #navbar",
	},
	{
		name: "nytimes",
		url: "https://www.nytimes.com/",
		sel: "header",
	},
	{
		name: "bbc",
		url: "https://www.bbc.com/",
		sel: "header",
	},
	{
		name: "cnn",
		url: "https://www.cnn.com/",
		sel: "header",
	},
	{
		name: "twitch",
		url: "https://www.twitch.tv/",
		sel: "nav",
	},
	{
		name: "spotify",
		url: "https://open.spotify.com/",
		sel: "[data-testid=main-view-container], main",
	},
	{
		name: "duckduckgo",
		url: "https://duckduckgo.com/",
		sel: "#searchbox_input, input[name=q]",
		steps: (f, p, r) =>
			search(
				f,
				"#searchbox_input, input[name=q]",
				"scramjet proxy",
				"[data-testid=result], article",
				r
			),
	},
	{
		name: "bing",
		url: "https://www.bing.com/",
		sel: "#sb_form_q",
		steps: (f, p, r) =>
			search(f, "#sb_form_q", "scramjet proxy", "#b_results li", r),
	},
	{
		name: "instagram",
		url: "https://www.instagram.com/",
		sel: "input[name=username], input[name=email], input[type=password]",
	},
	{
		name: "facebook",
		url: "https://www.facebook.com/",
		sel: "input[name=email]",
	},
	{
		name: "microsoft",
		url: "https://www.microsoft.com/en-us/",
		sel: "header",
	},
	{
		name: "apple",
		url: "https://www.apple.com/",
		sel: "#globalnav, nav",
	},
	{
		name: "cloudflare",
		url: "https://www.cloudflare.com/",
		sel: "header, main a",
	},
	{
		name: "npmjs",
		url: "https://www.npmjs.com/package/react",
		sel: "#readme",
	},
	{
		name: "mdn",
		url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
		sel: "main h1",
	},
	{
		name: "codepen",
		url: "https://codepen.io/",
		sel: "header, nav",
	},
	{
		name: "figma",
		url: "https://www.figma.com/",
		sel: "main a, footer",
	},
	{
		name: "notion",
		url: "https://www.notion.so/",
		sel: "nav, header",
	},
	{
		name: "google-docs",
		url: "https://docs.google.com/document/u/0/",
		sel: "input[type=email], #docs-homescreen",
	},
	{
		name: "google-maps",
		url: "https://www.google.com/maps",
		sel: "#searchboxinput, input[name=q], canvas",
	},
	{
		name: "google-translate",
		url: "https://translate.google.com/",
		sel: "textarea",
	},
	{
		name: "gmail",
		url: "https://mail.google.com/",
		sel: "input[type=email], a[href*='accounts.google.com']",
	},
	{
		name: "netflix",
		url: "https://www.netflix.com/",
		sel: "header",
	},
	{
		name: "tiktok",
		url: "https://www.tiktok.com/",
		sel: "[data-e2e]",
	},
	{
		name: "linkedin",
		url: "https://www.linkedin.com/",
		sel: "nav, header",
	},
	{
		name: "pinterest",
		url: "https://www.pinterest.com/",
		sel: "[data-test-id]",
	},
	{
		name: "yahoo",
		url: "https://www.yahoo.com/",
		sel: "#ybar, header",
	},
	{
		name: "ebay",
		url: "https://www.ebay.com/",
		sel: "#gh-ac, #gh",
	},
	{
		name: "weather",
		url: "https://weather.com/",
		sel: "header",
	},
	{
		name: "espn",
		url: "https://www.espn.com/",
		sel: "header",
	},
	{
		name: "imdb",
		url: "https://www.imdb.com/title/tt0111161/",
		sel: "h1",
	},
	{
		name: "archive",
		url: "https://archive.org/",
		sel: "app-root, ia-topnav",
	},
	{
		name: "excalidraw",
		url: "https://excalidraw.com/",
		sel: "canvas",
		settle: 4000,
	},
	{
		name: "nextjs-docs",
		url: "https://nextjs.org/docs",
		sel: "article h1, main h1",
	},
	{
		name: "vercel",
		url: "https://vercel.com/",
		sel: "nav, header",
	},
	{
		name: "react-dev",
		url: "https://react.dev/",
		sel: "main",
	},
	{
		name: "vuejs",
		url: "https://vuejs.org/",
		sel: ".VPNav, header",
	},
	{
		name: "angular-dev",
		url: "https://angular.dev/",
		sel: "nav, main",
	},
	{
		name: "svelte-dev",
		url: "https://svelte.dev/",
		sel: "nav, main",
	},
	{
		name: "poki",
		url: "https://poki.com/",
		sel: "a[href*='/g/']",
	},
	{
		name: "coolmathgames",
		url: "https://www.coolmathgames.com/",
		sel: "header, nav",
	},
	{
		name: "speedtest",
		url: "https://www.speedtest.net/",
		sel: ".start-button a, .js-start-test",
	},
];

const only = process.env.SWEEP_SITES?.split(",").filter(Boolean);

function trunc(s: string, n = 400) {
	return s.length > n ? s.slice(0, n) + "…" : s;
}

function runSite(site: Site) {
	return async (ctx: any) => {
		let rec: any;
		for (let attempt = 1; attempt <= 3; attempt++) {
			rec = await runOnce(site, ctx, attempt);
			const transportDead =
				(rec.reqCount ?? 0) <= 2 && ((rec.info?.elems ?? 0) <= 5 || rec.fatal);
			if (!transportDead) break;
		}
		writeFileSync(
			`${OUT}/results/${BUILD}/${site.name}.json`,
			JSON.stringify(rec, null, 1)
		);
	};
}

async function runOnce(
	site: Site,
	{ page, frame, navigate }: any,
	attempt: number
) {
	{
		const p: Page = page;
		const dir = `${OUT}/results/${BUILD}`;
		const shotDir = `${OUT}/shots/${BUILD}`;
		mkdirSync(dir, {
			recursive: true,
		});
		mkdirSync(shotDir, {
			recursive: true,
		});
		const rec: any = {
			site: site.name,
			url: site.url,
			attempt,
			build: BUILD,
			pageErrors: [],
			consoleErrors: [],
			scramjetConsole: [],
			failedRequests: [],
			badResponses: [],
		};
		let inflight = 0;
		let lastActivity = Date.now();
		let reqCount = 0;
		const onPageError = (e: Error) =>
			rec.pageErrors.push({
				message: trunc(e.message, 500),
				stack: trunc(e.stack ?? "", 2500),
			});
		const onConsole = (m: any) => {
			const text: string = m.text();
			const loc = m.location?.();
			const entry = {
				type: m.type(),
				text: trunc(text, 3000),
				loc: loc ? `${trunc(loc.url, 200)}:${loc.lineNumber}` : undefined,
			};
			if (m.type() === "error") rec.consoleErrors.push(entry);
			if (/scramjet|\$sj|\[sj|__sj/i.test(text))
				rec.scramjetConsole.push(entry);
		};
		const onReq = () => {
			inflight++;
			reqCount++;
			lastActivity = Date.now();
		};
		const onDone = () => {
			inflight = Math.max(0, inflight - 1);
			lastActivity = Date.now();
		};
		const onFailed = (r: any) => {
			onDone();
			const u: string = r.url();
			if (u.startsWith("data:")) return;
			rec.failedRequests.push({
				url: trunc(u, 300),
				type: r.resourceType(),
				failure: r.failure()?.errorText,
			});
		};
		const onResp = (r: any) => {
			if (r.status() >= 400)
				rec.badResponses.push({
					url: trunc(r.url(), 300),
					status: r.status(),
					type: r.request().resourceType(),
				});
		};
		p.on("pageerror", onPageError);
		p.on("console", onConsole);
		p.on("request", onReq);
		p.on("requestfinished", onDone);
		p.on("requestfailed", onFailed);
		p.on("response", onResp);
		const t0 = Date.now();
		try {
			await navigate(site.url);
			try {
				await frame.locator(site.sel).first().waitFor({
					state: "visible",
					timeout: 45000,
				});
				rec.selectorVisible = true;
				rec.loadMs = Date.now() - t0;
			} catch (e) {
				rec.selectorVisible = false;
				rec.selectorError = trunc(String(e), 300);
			}
			// network settle: 2s with no activity, cap 25s
			const sT = Date.now();
			while (Date.now() - sT < 25000) {
				if (Date.now() - lastActivity > 2000) break;
				await sleep(250);
			}
			rec.settleMs = Date.now() - t0;
			await sleep(site.settle ?? 2500);
			if (site.steps) {
				try {
					await site.steps(frame, p, rec);
				} catch (e) {
					rec.stepOk = false;
					rec.stepError = trunc(String(e), 300);
				}
				await sleep(2000);
			}
			try {
				rec.info = await frame.locator("body").evaluate(() => ({
					title: document.title,
					href: location.href,
					elems: document.getElementsByTagName("*").length,
					textLen: document.body?.innerText?.length ?? 0,
				}));
			} catch (e) {
				rec.info = {
					err: trunc(String(e), 200),
				};
			}
			try {
				await p.locator("#testframe").screenshot({
					path: `${shotDir}/${site.name}.png`,
					timeout: 15000,
				});
			} catch (e) {
				rec.shotError = trunc(String(e), 200);
			}
		} catch (e) {
			rec.fatal = trunc(String(e), 500);
		} finally {
			rec.totalMs = Date.now() - t0;
			rec.reqCount = reqCount;
			p.off("pageerror", onPageError);
			p.off("console", onConsole);
			p.off("request", onReq);
			p.off("requestfinished", onDone);
			p.off("requestfailed", onFailed);
			p.off("response", onResp);
			// unload the site so it stops consuming resources
			await p
				.evaluate(() => {
					(document.getElementById("testframe") as HTMLIFrameElement).src =
						"about:blank";
				})
				.catch(() => {});
			await sleep(500);
		}
		return rec;
	}
}

export default SITES.filter((s) => !only || only.includes(s.name)).map((s) =>
	playwrightTest({
		name: `rv9-site-${s.name}`,
		fn: runSite(s),
	})
);

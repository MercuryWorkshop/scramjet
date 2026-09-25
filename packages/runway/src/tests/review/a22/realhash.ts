import { playwrightTest } from "../../../testcommon.ts";
/* eslint-disable quotes */

const FIND = `(p) => [...document.querySelectorAll("a")].find((a) => { try { const u = new URL(a.href); return u.pathname === p && !u.hash; } catch { return false; } })`;
const FINDA = `(c) => [...(document.querySelector(c) || document).querySelectorAll("a")].find((a) => /^#[^#]/.test(a.getAttribute("href") || ""))`;
// Real sites: do a client-side (pushState) navigation, then click an in-page
// anchor. The document must survive (no reload).
const cases: [string, string, string, string][] = [
	// name, start, client-side link selector, in-page anchor selector
	["reactdev", "https://react.dev/learn", "/learn/thinking-in-react", "main"],
	[
		"nextjs-docs",
		"https://nextjs.org/docs",
		"/docs/app/getting-started/installation",
		"body",
	],
	[
		"vitepress",
		"https://vitepress.dev/guide/what-is-vitepress",
		"/guide/getting-started",
		".VPDocAsideOutline",
	],
	[
		"docusaurus",
		"https://docusaurus.io/docs",
		"/docs/installation",
		".table-of-contents",
	],
	[
		"svelte-docs",
		"https://svelte.dev/docs/svelte/overview",
		"/docs/svelte/getting-started",
		"main",
	],
	[
		"mdn",
		"https://developer.mozilla.org/en-US/docs/Web/API/History_API",
		"/en-US/docs/Web/API/History/pushState",
		"main",
	],
];

export default cases.map(([name, url, navSel, anchorSel]) =>
	Object.assign(
		playwrightTest({
			name: `rv22-realhash-${name}`,
			fn: async ({ page, navigate }) => {
				const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
				const fr = async () =>
					(await (await page.$("#testframe"))!.contentFrame())!;
				await navigate(url);
				let ok = false;
				for (let i = 0; i < 30 && !ok; i++) {
					await sleep(1000);
					try {
						ok = await (
							await fr()
						).evaluate(([f, s]) => !!(0, eval)(f)(s), [FIND, navSel]);
					} catch {}
				}
				if (!ok) throw new Error("nav link not found");
				await sleep(2000);
				await (
					await fr()
				).evaluate(() => {
					(window as any).__rv22m = 1;
				});
				await (
					await fr()
				).evaluate(([f, s]) => (0, eval)(f)(s).click(), [FIND, navSel]);
				await sleep(4000);
				const s1 = await (
					await fr()
				).evaluate(() => ({
					m: (window as any).__rv22m,
					t: document.title,
				}));
				if (s1.m !== 1)
					throw new Error(
						"client-side nav reloaded (router did not intercept): " +
							JSON.stringify(s1)
					);
				let a = false;
				for (let i = 0; i < 10 && !a; i++) {
					try {
						a = await (
							await fr()
						).evaluate(([f, s]) => !!(0, eval)(f)(s), [FINDA, anchorSel]);
					} catch {}
					if (!a) await sleep(1000);
				}
				if (!a)
					throw new Error("anchor not found after nav " + JSON.stringify(s1));
				const href = await (
					await fr()
				).evaluate(
					([f, s]) => {
						const el = (0, eval)(f)(s);
						el.scrollIntoView();
						const h = el.getAttribute("href");
						el.click();
						return h;
					},
					[FINDA, anchorSel]
				);
				await sleep(3000);
				const s2 = await (
					await fr()
				).evaluate(() => ({
					m: (window as any).__rv22m,
					t: document.title,
				}));
				console.log(
					"RV22REAL " +
						name +
						" " +
						JSON.stringify({
							s1,
							href,
							s2,
						})
				);
				if (s2.m !== 1)
					throw new Error(
						"anchor click " + href + " reloaded the page: " + JSON.stringify(s2)
					);
			},
		}),
		{
			timeoutMs: 120000,
		}
	)
);

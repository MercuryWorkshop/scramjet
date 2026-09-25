import { playwrightTest } from "../../../testcommon.ts";
/* eslint-disable quotes */

// Real module-based SPAs: two client-side navigations, then a reload. Count
// JS files that are requested under two different proxy URLs after the reload
// (same site URL, different proxy query), which for module scripts means two
// module instances.
const cases: [string, string, string, string][] = [
	[
		"vitepress",
		"https://vitepress.dev/guide/what-is-vitepress",
		"/guide/getting-started",
		"/guide/routing",
	],
	[
		"vuejs",
		"https://vuejs.org/guide/introduction.html",
		"/guide/quick-start.html",
		"/guide/essentials/application.html",
	],
	[
		"svelte",
		"https://svelte.dev/docs/svelte/overview",
		"/docs/svelte/getting-started",
		"/docs/svelte/svelte-files",
	],
];
const FIND = `(p) => [...document.querySelectorAll("a")].find((a) => { try { const u = new URL(a.href); return u.pathname === p && !u.hash; } catch { return false; } })`;

export default cases.map(([name, url, p1, p2]) =>
	Object.assign(
		playwrightTest({
			name: `rv22-realreload-${name}`,
			fn: async ({ page, navigate }) => {
				const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
				const fr = async () =>
					(await (await page.$("#testframe"))!.contentFrame())!;
				let reqs: string[] = [];
				const onReq = (r: any) => {
					const u = r.url();
					if (u.includes("/~/sj/") && /\.m?js/.test(decodeURIComponent(u)))
						reqs.push(u);
				};
				const errs: string[] = [];
				const onErr = (e: Error) => errs.push(String(e.message).slice(0, 150));
				page.on("request", onReq);
				page.on("pageerror", onErr);
				try {
					await navigate(url);
					for (const p of [p1, p2]) {
						let ok = false;
						for (let i = 0; i < 30 && !ok; i++) {
							await sleep(1000);
							try {
								ok = await (
									await fr()
								).evaluate(
									([f, s]) => {
										const a = (0, eval)(f)(s);
										if (a) a.click();
										return !!a;
									},
									[FIND, p]
								);
							} catch {}
						}
						if (!ok) throw new Error("link not found " + p);
						await sleep(3000);
					}
					await (
						await fr()
					).evaluate(() => {
						(window as any).__rv22m = 1;
					});
					reqs = [];
					errs.length = 0;
					await (
						await fr()
					).evaluate(() => setTimeout(() => location.reload(), 10));
					await sleep(8000);
					const m = await (await fr()).evaluate(() => (window as any).__rv22m);
					if (m === 1) throw new Error("did not reload");
					// group by the site URL (path part of the proxy URL), collect distinct proxy queries
					const by = new Map<string, Set<string>>();
					for (const u of reqs) {
						const x = new URL(u);
						const k = x.pathname;
						if (!by.has(k)) by.set(k, new Set());
						by.get(k)!.add(x.search);
					}
					const dup = [...by]
						.filter(([, s]) => s.size > 1)
						.map(
							([k, s]) =>
								decodeURIComponent(k).split("/").slice(-1)[0] +
								" x" +
								s.size +
								" " +
								[...s]
									.map((q) => decodeURIComponent(q).slice(0, 120))
									.join(" | ")
						);
					console.log(
						"RV22RELOAD " +
							name +
							" " +
							JSON.stringify({
								n: reqs.length,
								dup: dup.slice(0, 6),
								errs: errs.slice(0, 5),
							})
					);
					if (dup.length)
						throw new Error(
							dup.length +
								" JS files fetched under two proxy URLs after reload: " +
								dup.slice(0, 3).join(" ;; ") +
								" errors: " +
								JSON.stringify(errs.slice(0, 3))
						);
				} finally {
					page.off("request", onReq);
					page.off("pageerror", onErr);
				}
			},
		}),
		{
			timeoutMs: 150000,
		}
	)
);

import { playwrightTest } from "../../../testcommon.ts";

const sites = [
	["wikipedia", "https://en.wikipedia.org/wiki/Web_browser"],
	["github", "https://github.com/facebook/react"],
];

export default sites.map(([name, url]) =>
	playwrightTest({
		name: `rv2-siteperf-${name}`,
		fn: async ({ frame, navigate }) => {
			await navigate(url);
			await new Promise((r) => setTimeout(r, 8000));
			const res = await frame.locator("body").evaluate((b: HTMLElement) => {
				const d = b.ownerDocument;
				const w = d.defaultView as any;
				const time = (f: () => unknown, n: number) => {
					const t = w.performance.now();
					for (let i = 0; i < n; i++) f();
					return ((w.performance.now() - t) / n).toFixed(2) + "ms";
				};
				return [
					"els=" + d.getElementsByTagName("*").length,
					"body.textContent " + time(() => d.body.textContent, 10),
					"html.textContent " + time(() => d.documentElement.textContent, 10),
					"body.innerHTML " + time(() => d.body.innerHTML, 3),
					"html.outerHTML " + time(() => d.documentElement.outerHTML, 3),
					"qsa a[href] " + time(() => d.querySelectorAll("a[href]"), 50),
					"qsa * " + time(() => d.querySelectorAll("*"), 50),
					"links href " +
						time(() => {
							for (const a of d.querySelectorAll("a[href]"))
								(a as HTMLAnchorElement).href;
						}, 3),
					"imgs src " +
						time(() => {
							for (const a of d.images) a.src;
						}, 10),
					"clone body " + time(() => d.body.cloneNode(true), 3),
					"attrs walk " +
						time(() => {
							for (const e of d.getElementsByTagName("*"))
								for (const a of e.attributes) a.value;
						}, 3),
				].join("\n");
			});
			throw new Error("PERFREPORT\n" + res);
		},
	})
);

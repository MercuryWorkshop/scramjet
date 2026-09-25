import { playwrightTest } from "../../../testcommon.ts";

const probe = `(() => ({ maps: document.querySelectorAll('script[type=importmap]').length, mods: document.querySelectorAll('script[type=module]').length, canv: document.querySelectorAll('canvas').length, title: document.title.slice(0, 40), text: document.body ? document.body.innerText.length : -1, custom: [...document.querySelectorAll('*')].filter(e => e.localName.includes('-') && customElements.get(e.localName)).length }))()`;

const site = (name: string, url: string, waitMs = 12000) =>
	playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) =>
				errs.push("pageerror: " + String(e.message).slice(0, 160))
			);
			page.on("console", (m) => {
				if (m.type() === "error")
					errs.push("console: " + m.text().slice(0, 160));
			});
			page.on("response", (r) => {
				if (r.status() >= 400 && r.url().includes("/~/sj/"))
					errs.push(
						"http " +
							r.status() +
							" " +
							decodeURIComponent(r.url()).slice(0, 160)
					);
			});
			await navigate(url);
			await new Promise((r) => setTimeout(r, waitMs));
			const host = new URL(url).hostname;
			const fr = page
				.frames()
				.find(
					(f) =>
						f.url().includes(encodeURIComponent(host)) || f.url().includes(host)
				);
			let res: any = "no frame";
			if (fr) {
				try {
					res = await fr.evaluate(probe);
				} catch (e) {
					res = "probe threw: " + String(e).slice(0, 100);
				}
			}
			console.log("SITE " + name + " RESULT " + JSON.stringify(res));
			console.log(
				"SITE " + name + " ERRORS " + JSON.stringify(errs.slice(0, 20))
			);
		},
	});

export default [
	site(
		"rv16-site-three-bloom",
		"https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html"
	),
	site(
		"rv16-site-three-keyframes",
		"https://threejs.org/examples/webgl_animation_keyframes.html"
	),
	site("rv16-site-jspm", "https://jspm.org/"),
	site("rv16-site-jspm-generator", "https://generator.jspm.io/"),
	site("rv16-site-lit", "https://lit.dev/"),
	site("rv16-site-fresh", "https://fresh.deno.dev/"),
	site("rv16-site-hey", "https://www.hey.com/"),
	site("rv16-site-once", "https://once.com/"),
	site("rv16-site-wpnews", "https://wordpress.org/news/"),
	site("rv16-site-shoelace", "https://shoelace.style/"),
];

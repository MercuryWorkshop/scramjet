import { playwrightTest } from "../../../testcommon.ts";

const dbg = (name: string, url: string, probe: string) =>
	playwrightTest({
		name,
		fn: async ({ page, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e: any) => errs.push("pageerror: " + e.message));
			await navigate(url);
			await new Promise((r) => setTimeout(r, 10000));
			const host = new URL(url).hostname;
			const out: any[] = [];
			for (const f of page.frames()) {
				if (!f.url().includes("/~/sj/")) continue;
				try {
					out.push([
						decodeURIComponent(f.url()).slice(30, 120),
						await f.evaluate(probe),
					]);
				} catch (e) {
					out.push([f.url().slice(0, 80), "threw " + String(e).slice(0, 100)]);
				}
			}
			console.log(
				"CTRL " +
					name +
					" ERRS " +
					JSON.stringify(errs) +
					"\nPROBE " +
					JSON.stringify(out, null, 1)
			);
		},
	});

export default [
	dbg(
		"rv5-ctrl-soundcloud-direct",
		"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293",
		`(() => ({ title: document.title, btn: !!document.querySelector(".playButton, .sc-button-play, button"), text: document.body.innerText.slice(0, 100), sw: typeof navigator.serviceWorker, cookie: typeof document.cookie }))()`
	),
	dbg(
		"rv5-ctrl-recaptcha-demo",
		"https://www.google.com/recaptcha/api2/demo",
		`(() => ({ title: document.title, iframes: document.querySelectorAll("iframe").length, anchor: !!document.querySelector("#recaptcha-anchor"), text: document.body.innerText.slice(0, 80) }))()`
	),
];

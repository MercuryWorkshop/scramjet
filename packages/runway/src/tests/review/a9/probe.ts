// rv9 probe: load PROBE_URL, dump every frame's state + errors with stacks.
import { writeFileSync } from "node:fs";
import { playwrightTest } from "../../../testcommon.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const exports_default = [
	playwrightTest({
		name: "rv9-probe-dump",
		fn: async ({ page, navigate }) => {
			const url = process.env.PROBE_URL ?? "https://open.spotify.com/";
			const out: any = {
				errors: [],
				console: [],
				frames: [],
			};
			page.on("pageerror", (e) =>
				out.errors.push({
					m: e.message,
					s: e.stack?.slice(0, 3000),
				})
			);
			page.on("console", (m) => {
				if (m.type() === "error" || m.type() === "warning")
					out.console.push({
						t: m.type(),
						x: m.text().slice(0, 3000),
						l: m.location()?.url?.slice(0, 300),
					});
			});
			const t0 = Date.now();
			await navigate(url);
			await sleep(Number(process.env.PROBE_WAIT ?? 15000));
			for (const f of page.frames()) {
				let info: any;
				try {
					info = await f.evaluate(() => {
						const fe = (() => {
							try {
								return window.frameElement;
							} catch {
								return "throws";
							}
						})();
						return {
							sw: typeof (navigator as any).serviceWorker,
							secure: isSecureContext,
							origin: self.origin,
							ctl: typeof (window as any).$scramjetController,
							sj: typeof (window as any).$scramjet,
							feSandbox:
								fe && fe !== "throws"
									? (fe as Element).getAttribute("sandbox")
									: fe,
							feHtml:
								fe && fe !== "throws"
									? (fe as Element).outerHTML.slice(0, 600)
									: null,
						};
					});
				} catch (e) {
					info = {
						err: String(e).slice(0, 200),
					};
				}
				out.frames.push({
					url: f.url().slice(0, 400),
					...info,
				});
			}
			out.ms = Date.now() - t0;
			writeFileSync(
				process.env.PROBE_OUT ??
					"/home/velzie/.cache/sjreview/scratch-a9/probe.json",
				JSON.stringify(out, null, 1)
			);
		},
	}),
];

const timing = playwrightTest({
	name: "rv9-probe-time",
	fn: async ({ page, frame, navigate }) => {
		const url = process.env.PROBE_URL ?? "https://www.cnn.com/";
		const t0 = Date.now();
		let firstResp = -1;
		page.on("response", (r) => {
			if (
				firstResp < 0 &&
				r.request().resourceType() === "document" &&
				r.url().includes("/~/sj/")
			)
				firstResp = Date.now() - t0;
		});
		await navigate(url);
		let ok = false;
		try {
			await frame
				.locator(process.env.PROBE_SEL ?? "body :nth-child(20)")
				.first()
				.waitFor({
					state: "attached",
					timeout: 240000,
				});
			ok = true;
		} catch {}
		console.log(
			`RV9TIME url=${url} ok=${ok} docResponse=${firstResp}ms sel=${Date.now() - t0}ms`
		);
	},
});

(exports_default as any).push(timing);
export default exports_default;

import { writeFileSync } from "node:fs";
import { playwrightTest } from "../../../testcommon.ts";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export default [
	playwrightTest({
		name: "rv25-live-probe",
		fn: async ({ page, navigate }) => {
			const url = process.env.PROBE_URL ?? "https://www.youtube.com/";
			const out: any = {
				errors: [],
				console: [],
				frames: [],
			};
			page.on("pageerror", (e) => out.errors.push(e.message.slice(0, 400)));
			page.on("console", (m) => {
				if (m.type() === "error" || m.type() === "warning")
					out.console.push(m.type() + ": " + m.text().slice(0, 400));
			});
			out.bad = [];
			page.on("response", (r) => {
				if (r.status() >= 400)
					out.bad.push(
						r.status() + " " + decodeURIComponent(r.url()).slice(0, 250)
					);
			});
			await navigate(url);
			await sleep(Number(process.env.PROBE_WAIT ?? 15000));
			if (process.env.PROBE_EVAL) {
				for (const f of page.frames()) {
					if (!f.url().includes(process.env.PROBE_EVAL)) continue;
					try {
						out.evalResult = await f.evaluate(process.env.PROBE_JS!);
					} catch (e) {
						out.evalResult = "ERR " + String(e).slice(0, 300);
					}
					break;
				}
			}
			for (const f of page.frames()) {
				try {
					out.frames.push(
						await f.evaluate(() => ({
							u: location.href.slice(0, 150),
							tt:
								typeof trustedTypes !== "undefined" &&
								trustedTypes.defaultPolicy
									? trustedTypes.defaultPolicy.name
									: null,
							coi: self.crossOriginIsolated,
							nodes: document.getElementsByTagName("*").length,
							metaCsp: Array.from(
								document.querySelectorAll("meta[http-equiv]")
							).map(
								(m) =>
									m.getAttribute("http-equiv") +
									"=" +
									(m.getAttribute("content") || "").slice(0, 100)
							),
						}))
					);
				} catch (e) {
					out.frames.push({
						err: String(e).slice(0, 100),
					});
				}
			}
			writeFileSync(
				process.env.PROBE_OUT ?? "/tmp/a25probe.json",
				JSON.stringify(out, null, 1)
			);
		},
	}),
];

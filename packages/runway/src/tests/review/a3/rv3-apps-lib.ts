import http from "http";
import fs from "fs";
import path from "path";
import type { AddressInfo } from "node:net";
import type { Frame, Page } from "playwright";
import { playwrightTest } from "../../../testcommon.ts";

export const APPS = "/home/velzie/.cache/sjreview/scratch-a3/apps";
const OUT =
	"/home/velzie/.cache/sjreview/scratch-a3/apps-results/" +
	(process.cwd().includes("/sjreview/main/") ? "main" : "dev");

const MIME: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".png": "image/png",
	".svg": "image/svg+xml",
	".json": "application/json",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".webp": "image/webp",
	".jpg": "image/jpeg",
	".txt": "text/plain",
	".wasm": "application/wasm",
	".webmanifest": "application/manifest+json",
	".xml": "application/xml",
};

export type Step = {
	click?: string;
	text?: string;
	expect?: string;
	expectText?: string;
	wait?: number;
	evalLabel?: string;
	eval?: string;
};
export type AppSpec = {
	name: string;
	dir: string;
	spa?: boolean;
	path?: string;
	ready?: string;
	steps?: Step[];
	extra?: string;
	cleanUrls?: boolean;
};

function serve(root: string, spa: boolean, cleanUrls: boolean) {
	return http.createServer((req, res) => {
		let p = decodeURIComponent(new URL(req.url!, "http://x").pathname);
		let f = path.join(root, p);
		const tries = [f, f + ".html", path.join(f, "index.html")];
		let hit = tries.find((t) => fs.existsSync(t) && fs.statSync(t).isFile());
		if (!hit && spa) hit = path.join(root, "index.html");
		if (!hit) {
			res.writeHead(404);
			res.end("nf");
			return;
		}
		res.writeHead(200, {
			"content-type": MIME[path.extname(hit)] ?? "application/octet-stream",
		});
		fs.createReadStream(hit).pipe(res);
	});
}

async function runChecks(
	page: Page,
	getFrame: () => Frame,
	spec: AppSpec,
	log: string[]
) {
	const out: Record<string, unknown> = {};
	const fr = () => getFrame();
	const ready = spec.ready ?? "body *";
	try {
		await fr().waitForSelector(ready, {
			timeout: 20000,
			state: "attached",
		});
		out.ready = true;
	} catch {
		out.ready = false;
	}
	await new Promise((r) => setTimeout(r, 3000));
	const snap = async (label: string) => {
		try {
			out[label] = await fr().evaluate(() => {
				const p = (window as any).__probe;
				const imgs = [...document.images];
				return {
					probe: p
						? {
								...p,
								assetUrl: undefined,
								metaUrl: undefined,
							}
						: null,
					title: document.title,
					path: location.pathname + location.hash,
					textLen: document.body ? document.body.innerText.length : -1,
					text: document.body
						? document.body.innerText.replace(/\s+/g, " ").slice(0, 160)
						: "",
					imgs:
						imgs.length +
						" total, " +
						imgs.filter((i) => i.complete && i.naturalWidth > 0).length +
						" loaded",
					sheets: document.styleSheets.length,
					bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 40),
				};
			});
		} catch (e) {
			out[label] = "EVAL-ERR " + String(e).slice(0, 200);
		}
	};
	await snap("initial");
	let i = 0;
	for (const s of spec.steps ?? []) {
		i++;
		try {
			if (s.click) {
				const loc = s.text
					? fr()
							.locator(s.click, {
								hasText: s.text,
							})
							.first()
					: fr().locator(s.click).first();
				await loc.click({
					timeout: 10000,
				});
			}
			if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
			if (s.expect) {
				await fr().waitForSelector(s.expect, {
					timeout: 10000,
					state: "attached",
				});
			}
			if (s.expectText) {
				await fr().waitForFunction(
					(t) => document.body.innerText.includes(t),
					s.expectText,
					{
						timeout: 10000,
					}
				);
			}
			if (s.eval) out[s.evalLabel ?? "eval" + i] = await fr().evaluate(s.eval);
			out["step" + i] = "ok";
		} catch (e) {
			out["step" + i] = "FAIL " + String(e).split("\n")[0].slice(0, 200);
		}
	}
	if (spec.steps?.length) {
		await new Promise((r) => setTimeout(r, 1000));
		await snap("final");
	}
	return out;
}

export function appTest(spec: AppSpec) {
	return playwrightTest({
		name: "rv3-app-" + spec.name,
		fn: async ({ page, navigate }) => {
			const server = serve(
				path.join(APPS, spec.dir),
				!!spec.spa,
				!!spec.cleanUrls
			);
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as AddressInfo).port;
			const url = `http://localhost:${port}${spec.path ?? "/"}`;
			const log: string[] = [];
			const onResp = (r: any) => {
				if (r.status() >= 400)
					log.push(
						`HTTP ${r.status()} ${decodeURIComponent(r.url())
							.replace(/^.*?\/~\/sj\/[^/]+\/[^/]+\//, "")
							.slice(0, 160)}`
					);
			};
			const onFail = (r: any) =>
				log.push(
					`REQFAIL ${r.failure()?.errorText} ${decodeURIComponent(r.url())
						.replace(/^.*?\/~\/sj\/[^/]+\/[^/]+\//, "")
						.slice(0, 160)}`
				);
			const onCons = (m: any) => {
				if (m.type() === "error" || m.type() === "warning")
					log.push(
						`CONSOLE.${m.type()} ${m.text().replace(/\s+/g, " ").slice(0, 300)}`
					);
			};
			const onErr = (e: any) =>
				log.push(`PAGEERROR ${String(e.message).slice(0, 300)}`);
			// proxied
			page.on("response", onResp);
			page.on("requestfailed", onFail);
			page.on("console", onCons);
			page.on("pageerror", onErr);
			await navigate(url);
			const getFrame = () =>
				page
					.frames()
					.find(
						(f) =>
							(f !== page.mainFrame() &&
								f.url().includes(encodeURIComponent(`localhost:${port}`))) ||
							f.url().includes(`localhost%3A${port}`)
					)!;
			await page.waitForFunction(() => true);
			for (let k = 0; k < 50 && !getFrame(); k++)
				await new Promise((r) => setTimeout(r, 200));
			const proxied = getFrame()
				? await runChecks(page, getFrame, spec, log)
				: {
						noframe: page.frames().map((f) => f.url()),
					};
			page.off("response", onResp);
			page.off("requestfailed", onFail);
			page.off("console", onCons);
			page.off("pageerror", onErr);
			const plog = log.filter(
				(l) => !/\[scramjet\]|libcurl|navigating to|DevTools|quirky/.test(l)
			);
			// bare
			const bp = await page.context().newPage();
			const blog: string[] = [];
			bp.on("response", (r) => {
				if (r.status() >= 400)
					blog.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
			});
			bp.on("pageerror", (e) =>
				blog.push(`PAGEERROR ${e.message.slice(0, 300)}`)
			);
			bp.on("console", (m) => {
				if (m.type() === "error" || m.type() === "warning")
					blog.push(`CONSOLE.${m.type()} ${m.text().slice(0, 300)}`);
			});
			await bp.goto(url);
			const bare = await runChecks(bp, () => bp.mainFrame(), spec, blog);
			await bp.close();
			server.close();
			fs.mkdirSync(OUT, {
				recursive: true,
			});
			fs.writeFileSync(
				path.join(OUT, spec.name + ".json"),
				JSON.stringify(
					{
						proxied,
						bare,
						log: plog,
						bareLog: blog,
					},
					null,
					1
				)
			);
		},
	});
}

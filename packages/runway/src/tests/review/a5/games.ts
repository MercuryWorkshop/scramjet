import fs from "fs";
import { playwrightTest } from "../../../testcommon.ts";

// rv5 pass 3: games & interactive apps. Each test loads a real site through
// the proxy, waits, interacts, and logs one SUMMARY line; it only fails on a
// harness crash, so compare the SUMMARY lines between builds.

const SHOTS = "/home/velzie/.cache/sjreview/scratch-a5/shots";
fs.mkdirSync(SHOTS, {
	recursive: true,
});
const BUILD = process.cwd().includes("/sjreview/dev/") ? "dev" : "main";

type Ctx = {
	page: any;
	frame: any;
	fr: any;
	log: (s: string) => void;
};
type SiteOpts = {
	wait?: number;
	act?: (c: Ctx) => Promise<void>;
	probe?: string;
	after?: number;
};

const colorStats = async (page: any, buf: Buffer) =>
	page.evaluate(async (b64: string) => {
		const blob = await (await fetch("data:image/png;base64," + b64)).blob();
		const bmp = await createImageBitmap(blob);
		const c = new OffscreenCanvas(bmp.width, bmp.height);
		const g = c.getContext("2d")!;
		g.drawImage(bmp, 0, 0);
		const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
		const seen = new Set<number>();
		for (let i = 0; i < d.length; i += 4 * 7)
			seen.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3));
		return {
			w: bmp.width,
			h: bmp.height,
			colors: seen.size,
		};
	}, buf.toString("base64"));

const proxiedFrame = (page: any) =>
	page
		.frames()
		.find(
			(f: any) =>
				f.parentFrame() === page.mainFrame() && f.url().includes("/~/sj/")
		);

const site = (name: string, url: string, o: SiteOpts = {}) => {
	const t = playwrightTest({
		name,
		fn: async ({ page, frame, navigate }) => {
			const errs: string[] = [];
			const notes: string[] = [];
			const log = (s: string) => notes.push(s);
			page.on("pageerror", (e: any) =>
				errs.push("PE " + String(e.message).slice(0, 160))
			);
			page.on("console", (m: any) => {
				if (m.type() === "error") {
					const txt = m.text();
					if (
						/Failed to load resource|ERR_|net::|Refused to execute script|^Request "|Syncing cannot|controller request handler|Request failed with error code|CORS policy|Content Security Policy|Access-Control/.test(
							txt
						)
					)
						return;
					errs.push("CE " + txt.replace(/\s+/g, " ").slice(0, 160));
				}
			});
			const t0 = Date.now();
			let navErr = "";
			try {
				await navigate(url);
			} catch (e) {
				navErr = String(e).slice(0, 120);
			}
			let swErr = "";
			for (let attempt = 0; attempt < 10; attempt++) {
				await new Promise((r) => setTimeout(r, 3000));
				const f0 = proxiedFrame(page);
				const txt = f0
					? await f0
							.evaluate(
								`document.body ? document.body.innerText.slice(0, 200) : ""`
							)
							.catch(() => "")
					: "";
				if (
					!/Internal Service Worker Error|Request failed with error code/.test(
						txt
					)
				) {
					swErr = "";
					break;
				}
				swErr = txt.replace(/\s+/g, " ").slice(0, 140);
				try {
					await navigate(url);
				} catch (e) {}
			}
			const navMs = Date.now() - t0;
			await new Promise((r) => setTimeout(r, o.wait ?? 10000));
			const fr = proxiedFrame(page);
			let actErr = "";
			if (o.act && fr) {
				try {
					await o.act({
						page,
						frame,
						fr,
						log,
					});
				} catch (e) {
					actErr = String(e).split("\n")[0].slice(0, 160);
				}
				await new Promise((r) => setTimeout(r, o.after ?? 4000));
			}
			let probe: any = null;
			const cur = proxiedFrame(page);
			if (cur) {
				try {
					probe = await cur.evaluate(
						o.probe ??
							`(() => ({ title: document.title.slice(0, 50), canvases: [...document.querySelectorAll("canvas")].filter(c => c.width * c.height > 10000).length, text: document.body ? document.body.innerText.length : -1 }))()`
					);
				} catch (e) {
					probe = "probe threw: " + String(e).slice(0, 100);
				}
			}
			let shot: any = null;
			try {
				const el = page.locator("iframe").first();
				const buf = await el.screenshot({
					timeout: 10000,
				});
				fs.writeFileSync(`${SHOTS}/${name}-${BUILD}.png`, buf);
				shot = await colorStats(page, buf);
			} catch (e) {
				shot = "shot failed " + String(e).slice(0, 80);
			}
			const uniq = [...new Set(errs)];
			console.log(
				"SUMMARY " +
					JSON.stringify({
						name,
						navMs,
						navErr,
						swErr,
						actErr,
						colors: shot && shot.colors,
						probe,
						notes,
						nerr: uniq.length,
						errs: uniq.slice(0, 12),
					})
			);
		},
	});
	t.timeoutMs = 180000;
	return t;
};

const clickText = async (c: Ctx, re: RegExp, timeout = 8000) => {
	const l = c.frame.getByText(re).first();
	await l.click({
		timeout,
	});
	c.log("clicked " + re);
};
const clickSel = async (c: Ctx, sel: string, timeout = 8000) => {
	await c.frame.locator(sel).first().click({
		timeout,
	});
	c.log("clicked " + sel);
};
const keys = async (c: Ctx, ks: string[], delay = 200) => {
	await c.frame
		.locator("body")
		.first()
		.click({
			timeout: 5000,
			position: {
				x: 300,
				y: 300,
			},
		})
		.catch(() => {});
	for (const k of ks) {
		await c.page.keyboard.press(k);
		await new Promise((r) => setTimeout(r, delay));
	}
	c.log("pressed " + ks.length);
};

export default [
	// --- games & portals ---
	site("rv5-game-poki-home", "https://poki.com/", {
		wait: 12000,
	}),
	site("rv5-game-poki-game", "https://poki.com/en/g/subway-surfers", {
		wait: 25000,
		act: async (c) => {
			await c.frame
				.locator("canvas, iframe")
				.first()
				.click({
					timeout: 8000,
				})
				.catch(() => {});
		},
		after: 10000,
		probe: `(() => ({ iframes: [...document.querySelectorAll("iframe")].map(f => f.src.slice(0, 80)), canvases: document.querySelectorAll("canvas").length }))()`,
	}),
	site("rv5-game-crazygames", "https://www.crazygames.com/game/bloxdhop-io", {
		wait: 25000,
		probe: `(() => ({ iframes: [...document.querySelectorAll("iframe")].map(f => f.src.slice(0, 80)), title: document.title.slice(0, 40) }))()`,
	}),
	site("rv5-game-coolmath", "https://www.coolmathgames.com/0-run-3", {
		wait: 20000,
	}),
	site("rv5-game-krunker", "https://krunker.io/", {
		wait: 30000,
	}),
	site("rv5-game-slither", "https://slither.io/", {
		wait: 15000,
		act: async (c) => {
			await clickSel(c, "#playh .btnt, .btnt");
		},
		after: 8000,
	}),
	site("rv5-game-agar", "https://agar.io/", {
		wait: 20000,
	}),
	site("rv5-game-diep", "https://diep.io/", {
		wait: 20000,
	}),
	site("rv5-game-2048", "https://play2048.co/", {
		wait: 8000,
		act: async (c) => {
			await keys(c, [
				"ArrowLeft",
				"ArrowUp",
				"ArrowRight",
				"ArrowDown",
				"ArrowLeft",
				"ArrowUp",
				"ArrowRight",
				"ArrowDown",
			]);
		},
		probe: `(() => ({ tiles: document.querySelectorAll(".tile, [class*=tile]").length, score: (document.querySelector(".score-container, [class*=score]") || {}).textContent, ls: Object.keys(localStorage).length }))()`,
	}),
	site("rv5-game-chess-computer", "https://www.chess.com/play/computer", {
		wait: 15000,
		probe: `(() => ({ board: !!document.querySelector("wc-chess-board, chess-board, .board"), pieces: document.querySelectorAll(".piece").length }))()`,
	}),
	site("rv5-game-lichess-analysis", "https://lichess.org/analysis", {
		wait: 10000,
		act: async (c) => {
			await keys(c, ["ArrowRight"]);
			await c.frame
				.locator("cg-board")
				.first()
				.click({
					timeout: 5000,
					position: {
						x: 150,
						y: 330,
					},
				});
			await c.frame
				.locator("cg-board")
				.first()
				.click({
					timeout: 5000,
					position: {
						x: 150,
						y: 250,
					},
				});
		},
		probe: `(() => ({ board: !!document.querySelector("cg-board"), pieces: document.querySelectorAll("piece").length, ceval: !!document.querySelector(".ceval, .engine") , moves: document.querySelectorAll("move, kwdb").length }))()`,
	}),
	site("rv5-game-lichess-ai", "https://lichess.org/setup/ai", {
		wait: 10000,
		probe: `(() => ({ title: document.title.slice(0, 40), url: location.href, board: !!document.querySelector("cg-board") }))()`,
	}),
	site("rv5-game-geoguessr", "https://www.geoguessr.com/", {
		wait: 12000,
	}),
	site("rv5-game-skribbl", "https://skribbl.io/", {
		wait: 12000,
		probe: `(() => ({ play: !!document.querySelector("button.button-play, .button-play"), avatar: document.querySelectorAll(".avatar canvas, .avatar div").length, ws: typeof WebSocket }))()`,
	}),
	site("rv5-game-monkeytype", "https://monkeytype.com/", {
		wait: 12000,
		act: async (c) => {
			await c.frame
				.locator("#wordsWrapper, #words")
				.first()
				.click({
					timeout: 6000,
				})
				.catch(() => {});
			await c.page.keyboard.type("the quick brown fox ", {
				delay: 60,
			});
		},
		probe: `(() => ({ words: document.querySelectorAll("#words .word").length, typed: document.querySelectorAll("#words .word.typed, #words letter.correct").length }))()`,
	}),
	site("rv5-game-tetrio", "https://tetr.io/", {
		wait: 25000,
	}),
	site(
		"rv5-game-unity-play",
		"https://play.unity.com/en/games/c6aafe95-1ce0-4d2d-943c-4a34f6efa4d1/getting-started-playground",
		{
			wait: 30000,
		}
	),
	site("rv5-game-godot-demo", "https://godotengine.org/showcase/", {
		wait: 10000,
	}),
	site("rv5-game-jsdos", "https://js-dos.com/", {
		wait: 20000,
	}),
	site("rv5-game-dosgames", "https://www.dosgames.com/game/doom/", {
		wait: 15000,
	}),
	site("rv5-game-ruffle-demo", "https://ruffle.rs/demo/", {
		wait: 20000,
	}),
	site("rv5-game-scratch", "https://scratch.mit.edu/projects/10128407/", {
		wait: 20000,
		act: async (c) => {
			await clickSel(c, ".green-flag, [class*=green-flag]", 10000);
		},
		after: 6000,
		probe: `(() => ({ canvas: !!document.querySelector("canvas"), flagActive: !!document.querySelector("[class*=is-active]"), title: document.title.slice(0, 40) }))()`,
	}),
	site("rv5-game-mc-classic", "https://classic.minecraft.net/", {
		wait: 25000,
	}),
	site("rv5-game-nowgg", "https://now.gg/", {
		wait: 12000,
	}),

	// --- interactive apps ---
	site("rv5-app-gmaps", "https://www.google.com/maps/@40.7,-74,12z", {
		wait: 15000,
		act: async (c) => {
			const m = c.frame.locator("canvas, #scene").first();
			const b = await m.boundingBox();
			if (b) {
				await c.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
				await c.page.mouse.down();
				await c.page.mouse.move(
					b.x + b.width / 2 + 150,
					b.y + b.height / 2 + 80,
					{
						steps: 10,
					}
				);
				await c.page.mouse.up();
				await c.page.mouse.wheel(0, -400);
			}
		},
		probe: `(() => ({ url: location.href.slice(0, 90), canvases: document.querySelectorAll("canvas").length, search: !!document.querySelector("input#searchboxinput, input[name=q]") }))()`,
	}),
	site(
		"rv5-app-translate",
		"https://translate.google.com/?sl=en&tl=fr&text=hello%20world&op=translate",
		{
			wait: 12000,
			probe: `(() => ({ out: [...document.querySelectorAll("[lang=fr], span[jsname]")].map(e => e.textContent).filter(t => /bonjour/i.test(t)).slice(0, 2) }))()`,
		}
	),
	site("rv5-app-photopea", "https://www.photopea.com/", {
		wait: 25000,
	}),
	site("rv5-app-figma-community", "https://www.figma.com/community", {
		wait: 15000,
	}),
	site("rv5-app-canva", "https://www.canva.com/", {
		wait: 15000,
	}),
	site("rv5-app-codepen-editor", "https://codepen.io/pen/", {
		wait: 15000,
		probe: `(() => ({ editors: document.querySelectorAll(".CodeMirror, .cm-editor, .monaco-editor").length, preview: !!document.querySelector("iframe#result, iframe[name=CodePen]") }))()`,
	}),
	site("rv5-app-stackblitz", "https://stackblitz.com/", {
		wait: 12000,
	}),
	site("rv5-app-codesandbox", "https://codesandbox.io/", {
		wait: 12000,
	}),
	site("rv5-app-mdn-playground", "https://developer.mozilla.org/en-US/play", {
		wait: 15000,
		probe: `(() => ({ editors: document.querySelectorAll(".cm-editor, play-editor").length, runner: document.querySelectorAll("iframe, play-runner").length }))()`,
	}),
	site("rv5-app-regex101", "https://regex101.com/", {
		wait: 12000,
		probe: `(() => ({ editors: document.querySelectorAll(".cm-editor, .CodeMirror, textarea").length }))()`,
	}),
	site("rv5-app-desmos", "https://www.desmos.com/calculator", {
		wait: 12000,
		act: async (c) => {
			await clickSel(
				c,
				".dcg-mq-root-block, .dcg-expressionitem .dcg-math-field, .dcg-mq-editable-field",
				10000
			);
			await c.page.keyboard.type("y=x^2", {
				delay: 80,
			});
		},
		probe: `(() => ({ exprs: document.querySelectorAll(".dcg-expressionitem").length, canvases: document.querySelectorAll("canvas").length, latex: (window.Calc && Calc.getExpressions) ? Calc.getExpressions().map(e => e.latex) : "noCalc" }))()`,
	}),
	site("rv5-app-geogebra", "https://www.geogebra.org/calculator", {
		wait: 20000,
	}),
	site("rv5-app-wolfram", "https://www.wolframalpha.com/input?i=2%2B2", {
		wait: 15000,
		probe: `(() => ({ has4: /\\b4\\b/.test(document.body.innerText), len: document.body.innerText.length }))()`,
	}),
	site("rv5-app-spotify", "https://open.spotify.com/", {
		wait: 15000,
	}),
	site("rv5-app-soundcloud-track", "https://soundcloud.com/forss/flickermood", {
		wait: 12000,
		act: async (c) => {
			await clickSel(
				c,
				".sc-button-play, .playButton, button[title=Play]",
				10000
			);
		},
		after: 8000,
		probe: `(() => ({ playing: !!document.querySelector(".playing, .sc-button-pause, [title=Pause]"), time: (document.querySelector(".playbackTimeline__timePassed span:last-child") || {}).textContent }))()`,
	}),
	site("rv5-app-twitch-channel", "https://www.twitch.tv/twitchgaming", {
		wait: 20000,
		probe: `(() => { const v = document.querySelector("video"); return { video: !!v, t: v && v.currentTime, paused: v && v.paused, ready: v && v.readyState }; })()`,
	}),
	site("rv5-app-youtube-watch", "https://www.youtube.com/watch?v=M7lc1UVf-VE", {
		wait: 15000,
		act: async (c) => {
			const t1 = await c.fr.evaluate(
				`(() => { const v = document.querySelector("video"); if (v) { v.muted = true; v.play().catch(()=>{}); } return v ? v.currentTime : -1; })()`
			);
			await new Promise((r) => setTimeout(r, 6000));
			const t2 = await c.fr.evaluate(
				`(() => { const v = document.querySelector("video"); return v ? v.currentTime : -1; })()`
			);
			c.log("yt currentTime " + t1 + " -> " + t2);
		},
		probe: `(() => { const v = document.querySelector("video"); return { video: !!v, t: v && v.currentTime, paused: v && v.paused, src: v && v.src.slice(0, 20) }; })()`,
	}),
	site("rv5-app-netflix", "https://www.netflix.com/", {
		wait: 10000,
	}),
	site("rv5-app-disney", "https://www.disneyplus.com/", {
		wait: 12000,
	}),
	site("rv5-app-discord-login", "https://discord.com/login", {
		wait: 15000,
		probe: `(() => ({ qr: !!document.querySelector("[class*=qrCode] svg, [class*=qrCode] canvas, svg[class*=qr]"), qrText: (document.querySelector("[class*=qrLogin], [class*=qrCode]") || {}).innerText, form: !!document.querySelector("input[name=email]") }))()`,
	}),
	site("rv5-app-chatgpt", "https://chatgpt.com/", {
		wait: 15000,
	}),
	site("rv5-app-claude", "https://claude.ai/", {
		wait: 12000,
	}),
];

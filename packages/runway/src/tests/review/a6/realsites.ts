import { htmlTest, playwrightTest, type Test } from "../../../testcommon.ts";

const yt = htmlTest({
	name: "rv6-real-youtube-iframe-api",
	html: `<!doctype html><body><div id="player"></div>
	<script>
		window.__log = [];
		runTest(async () => {
			await new Promise((res, rej) => {
				window.onYouTubeIframeAPIReady = () => {
					window.__log.push("api");
					new YT.Player("player", { height: "200", width: "300", videoId: "M7lc1UVf-VE",
						events: { onReady: (e) => { window.__log.push("ready"); try { const d = e.target.getDuration(); window.__log.push("dur" + d); res(); } catch (x) { rej(x); } } } });
				};
				const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
				setTimeout(() => rej(new Error("timeout log=" + window.__log.join(","))), 25000);
			});
		});
	</script></body>`,
});
yt.timeoutMs = 35000;

const recaptcha = playwrightTest({
	name: "rv6-real-recaptcha-demo",
	fn: async ({ page, frame, navigate }) => {
		const errs: string[] = [];
		page.on("pageerror", (e) => errs.push(String(e)));
		await navigate("https://www.google.com/recaptcha/api2/demo");
		const anchor = frame.frameLocator("iframe[title='reCAPTCHA']");
		await anchor.locator("#recaptcha-anchor").waitFor({
			state: "visible",
			timeout: 25000,
		});
		await anchor.locator("#recaptcha-anchor").click();
		// after click, the checkbox either checks or opens a bframe challenge; both need postMessage
		await page.waitForTimeout(5000);
		const checked = await anchor
			.locator("#recaptcha-anchor")
			.getAttribute("aria-checked");
		const bframeVisible = await frame
			.locator("iframe[title*='challenge']")
			.count();
		if (checked !== "true" && bframeVisible === 0)
			throw new Error(
				"no reaction to click; errs=" + errs.slice(0, 5).join(" | ")
			);
	},
});
(recaptcha as any).timeoutMs = 60000;

const ytpw = playwrightTest({
	name: "rv6-real-ytpw",
	fn: async ({ page, frame, navigate }) => {
		const errs: string[] = [];
		page.on("pageerror", (e) => errs.push("PE " + String(e).slice(0, 200)));
		page.on("console", (m) => {
			if (m.type() === "error" || m.type() === "warning")
				errs.push(m.type() + " " + m.text().slice(0, 200));
		});
		await navigate(
			"https://www.w3schools.com/html/tryit.asp?filename=tryhtml_youtubeiframe"
		);
		await page.waitForTimeout(1000);
		const log = await frame.locator("body").evaluate(async () => {
			const w: any = window;
			w.__log = [];
			const div = document.createElement("div");
			div.id = "rvplayer";
			document.body.prepend(div);
			return await new Promise((res) => {
				w.onYouTubeIframeAPIReady = () => {
					w.__log.push("api");
					new w.YT.Player("rvplayer", {
						height: "200",
						width: "300",
						videoId: "M7lc1UVf-VE",
						events: {
							onReady: (e: any) => {
								w.__log.push("ready dur=" + e.target.getDuration());
								res(w.__log.join(","));
							},
						},
					});
				};
				const s = document.createElement("script");
				s.src = "https://www.youtube.com/iframe_api";
				document.head.appendChild(s);
				setTimeout(() => res("timeout " + w.__log.join(",")), 25000);
			});
		});
		if (!String(log).includes("ready"))
			throw new Error("log=" + log + " errs=" + errs.slice(0, 15).join(" || "));
	},
});
(ytpw as any).timeoutMs = 60000;

const vimeo = htmlTest({
	name: "rv6-real-vimeo-player-api",
	html: `<!doctype html><body><iframe id="v" src="https://player.vimeo.com/video/76979871?h=8272103f6e" width="320" height="180" allow="autoplay"></iframe>
	<script src="https://player.vimeo.com/api/player.js"></script>
	<script>
		runTest(async () => {
			const player = new Vimeo.Player(document.getElementById("v"));
			const d = await Promise.race([player.getDuration(), new Promise((_, rej) => setTimeout(() => rej(new Error("vimeo getDuration timeout")), 20000))]);
			assert(d > 0, "duration " + d);
		});
	</script></body>`,
});
vimeo.timeoutMs = 30000;

const stripe = playwrightTest({
	name: "rv6-real-stripe-elements",
	fn: async ({ page, frame, navigate }) => {
		await navigate("https://stripe.dev/elements-examples/");
		const card = frame
			.frameLocator("iframe[name^='__privateStripeFrame']")
			.first();
		const input = card
			.locator("input[name='cardnumber'], input[name='number']")
			.first();
		await input.waitFor({
			state: "visible",
			timeout: 25000,
		});
		await input.click();
		await input.pressSequentially("4242424242424242", {
			delay: 20,
		});
		await page.waitForTimeout(1500);
		const v = await input.inputValue();
		if (!v.replace(/\s/g, "").startsWith("4242"))
			throw new Error("card input value " + v);
	},
});
(stripe as any).timeoutMs = 60000;

export default [yt, recaptcha, ytpw, vimeo, stripe] as Test[];

import { htmlTest, type Test } from "../../../testcommon.ts";

const t = (name: string, html: string, ms = 40000) => {
	const x = htmlTest({
		name,
		html,
	});
	x.timeoutMs = ms;
	return x;
};

const base = [
	t(
		"rv21-real-turnstile",
		`<!doctype html><body><div id="ts"></div>
	<script>
		window.onloadTurnstileCallback = () => {};
		runTest(async () => {
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); });
			const tok = await new Promise((res, rej) => {
				turnstile.render("#ts", { sitekey: "1x00000000000000000000AA", callback: res, "error-callback": (e) => rej(new Error("turnstile error " + e)) });
				setTimeout(() => rej(new Error("turnstile timeout")), 30000);
			});
			assert(typeof tok === "string" && tok.length > 5, "token " + tok);
		}, true);
	</script></body>`
	),
	t(
		"rv21-real-twitter-tweet",
		`<!doctype html><body><div id="tw"></div>
	<script>
		runTest(async () => {
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); });
			const el = await Promise.race([twttr.widgets.createTweet("20", document.getElementById("tw")), new Promise((_, r) => setTimeout(() => r(new Error("tweet timeout")), 30000))]);
			assert(el, "tweet element");
			await new Promise((r) => setTimeout(r, 2000));
			const h = el.getBoundingClientRect().height;
			assert(h > 100, "tweet height " + h);
		}, true);
	</script></body>`
	),
	t(
		"rv21-real-hcaptcha",
		`<!doctype html><body><div id="hc"></div>
	<script>
		runTest(async () => {
			await new Promise((res, rej) => { window.hcOnload = res; const s = document.createElement("script"); s.src = "https://js.hcaptcha.com/1/api.js?onload=hcOnload&render=explicit"; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); setTimeout(() => rej(new Error("hc load timeout")), 20000); });
			const id = hcaptcha.render("hc", { sitekey: "10000000-ffff-ffff-ffff-000000000001", size: "invisible" });
			const r = await Promise.race([hcaptcha.execute(id, { async: true }), new Promise((_, r) => setTimeout(() => r(new Error("hc execute timeout")), 25000))]);
			assert(r && r.response, "hcaptcha response " + JSON.stringify(r));
		}, true);
	</script></body>`
	),
];
export const more = [
	t(
		"rv21-real-spotify",
		`<!doctype html><body><div id="sp"></div>
	<script>
		runTest(async () => {
			const api = await new Promise((res, rej) => { window.onSpotifyIframeApiReady = res; const s = document.createElement("script"); s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); setTimeout(() => rej(new Error("api timeout")), 20000); });
			await new Promise((res, rej) => {
				api.createController(document.getElementById("sp"), { uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC", width: 300, height: 152 }, (c) => { c.addListener("ready", res); });
				setTimeout(() => rej(new Error("spotify ready timeout")), 25000);
			});
		}, true);
	</script></body>`
	),
	t(
		"rv21-real-soundcloud",
		`<!doctype html><body><iframe id="sc" width="300" height="166" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293"></iframe>
	<script>
		runTest(async () => {
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://w.soundcloud.com/player/api.js"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); });
			const w = SC.Widget(document.getElementById("sc"));
			await new Promise((res, rej) => { w.bind(SC.Widget.Events.READY, res); setTimeout(() => rej(new Error("sc ready timeout")), 25000); });
			const d = await new Promise((res) => w.getDuration(res));
			assert(d > 0, "duration " + d);
		}, true);
	</script></body>`
	),
];

export default [...base, ...more] as Test[];

import { serverTest } from "../../../testcommon.ts";

// rv5 pass 2: real third-party embeds loaded into a proxied page.

const embed = (
	name: string,
	head: string,
	body: string,
	js: string,
	timeoutMs = 45000
) => {
	const t = serverTest({
		name,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>embed</title>${head}</head><body>${body}
<script>
const waitFor = (fn, ms = 30000, what = "condition") => new Promise((res, rej) => {
	const t0 = Date.now();
	const tick = () => { let v; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > ms) return rej(new Error("timeout waiting for " + what)); setTimeout(tick, 100); };
	tick();
});
const loadScript = (src, attrs = {}) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; for (const k in attrs) s.setAttribute(k, attrs[k]); s.onload = res; s.onerror = () => rej(new Error("script failed: " + src)); document.head.appendChild(s); });
const frameLoaded = (sel, ms = 30000) => waitFor(() => document.querySelector(sel), ms, sel).then((f) => new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(f); } }; f.addEventListener("load", fin); setTimeout(fin, 8000); }));
runTest(async () => {
${js}
}, true);
</script></body></html>`);
					return;
				}
				res.writeHead(404);
				res.end();
			});
		},
	});
	t.timeoutMs = timeoutMs;
	return t;
};

export default [
	embed(
		"rv5-embed-youtube-iframe-api",
		"",
		`<div id="player"></div>`,
		`
		const ready = new Promise((res, rej) => {
			window.onYouTubeIframeAPIReady = () => {
				const p = new YT.Player("player", { height: "200", width: "320", videoId: "M7lc1UVf-VE", playerVars: { mute: 1 },
					events: { onReady: () => res(p), onError: (e) => rej(new Error("YT onError " + e.data)) } });
			};
		});
		await loadScript("https://www.youtube.com/iframe_api");
		const p = await ready;
		const d = await waitFor(() => p.getDuration() > 0 && p.getDuration(), 20000, "duration");
		assert(d > 0, "duration");
		assert(String(p.getVideoUrl()).includes("M7lc1UVf-VE"), "getVideoUrl: " + p.getVideoUrl());
		p.mute(); p.playVideo();
		await waitFor(() => [1, 3].includes(p.getPlayerState()), 20000, "playing/buffering state");
		p.pauseVideo();
		`
	),
	embed(
		"rv5-embed-youtube-plain-iframe",
		"",
		`<iframe id="yt" width="320" height="200" src="https://www.youtube.com/embed/M7lc1UVf-VE?enablejsapi=1"></iframe>`,
		`
		const f = await frameLoaded("#yt");
		const got = new Promise((res) => addEventListener("message", (e) => { if (String(e.origin).includes("youtube.com")) res(e); }));
		const iv = setInterval(() => f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "https://www.youtube.com"), 300);
		const e = await Promise.race([got, new Promise((_, j) => setTimeout(() => j(new Error("no message from youtube iframe")), 20000))]);
		clearInterval(iv);
		assertEqual(e.origin, "https://www.youtube.com", "message origin");
		assert(e.source === f.contentWindow, "message source");
		`
	),
	embed(
		"rv5-embed-vimeo-playerjs",
		"",
		`<iframe id="vm" src="https://player.vimeo.com/video/76979871?muted=1" width="320" height="200" allow="autoplay"></iframe>`,
		`
		await loadScript("https://player.vimeo.com/api/player.js");
		const p = new Vimeo.Player(document.getElementById("vm"));
		await Promise.race([p.ready(), new Promise((_, j) => setTimeout(() => j(new Error("vimeo ready timeout")), 20000))]);
		const d = await p.getDuration();
		assert(d > 0, "duration " + d);
		const title = await p.getVideoTitle();
		assert(title, "title");
		`
	),
	embed(
		"rv5-embed-google-maps-js",
		"",
		`<div id="map" style="width:400px;height:300px"></div>`,
		`
		window.initMap = () => { window.__map = new google.maps.Map(document.getElementById("map"), { center: { lat: 40.7, lng: -74 }, zoom: 10 }); };
		await loadScript("https://maps.googleapis.com/maps/api/js?callback=initMap");
		await waitFor(() => window.__map, 20000, "map object");
		await waitFor(() => document.querySelectorAll("#map img, #map canvas").length > 0, 20000, "map tiles/imagery");
		`
	),
	embed(
		"rv5-embed-google-maps-iframe",
		"",
		`<iframe id="gm" width="400" height="300" src="https://maps.google.com/maps?q=eiffel+tower&output=embed"></iframe>`,
		`
		await frameLoaded("#gm");
		`
	),
	embed(
		"rv5-embed-recaptcha-v2",
		"",
		`<div id="rc"></div>`,
		`
		window.onRc = () => { window.__wid = grecaptcha.render("rc", { sitekey: "6LeIxAcTAAAAAJcZVRqyHh4j4mZ8qNFy0jJXh2" }); };
		await loadScript("https://www.google.com/recaptcha/api.js?onload=onRc&render=explicit");
		await waitFor(() => window.__wid !== undefined, 20000, "render");
		const f = await frameLoaded("#rc iframe");
		assert(String(f.src).includes("recaptcha"), "anchor iframe src " + f.src);
		assertEqual(typeof grecaptcha.getResponse(__wid), "string", "getResponse");
		`
	),
	embed(
		"rv5-embed-recaptcha-v3",
		"",
		``,
		`
		await loadScript("https://www.google.com/recaptcha/api.js?render=6LeIxAcTAAAAAJcZVRqyHh4j4mZ8qNFy0jJXh2");
		await new Promise((r) => grecaptcha.ready(r));
		const tok = await Promise.race([grecaptcha.execute("6LeIxAcTAAAAAJcZVRqyHh4j4mZ8qNFy0jJXh2", { action: "submit" }).catch((e) => "rejected:" + e), new Promise((r) => setTimeout(() => r("timeout"), 15000))]);
		assertConsistent("v3 token kind", typeof tok === "string" && tok.length > 20 ? "token" : String(tok).slice(0, 30));
		`
	),
	embed(
		"rv5-embed-hcaptcha",
		"",
		`<div id="hc"></div>`,
		`
		window.onHc = () => { window.__hid = hcaptcha.render("hc", { sitekey: "10000000-ffff-ffff-ffff-000000000001" }); };
		await loadScript("https://js.hcaptcha.com/1/api.js?onload=onHc&render=explicit");
		await waitFor(() => window.__hid !== undefined, 20000, "render");
		const f = await frameLoaded("#hc iframe");
		const tok = await Promise.race([hcaptcha.execute(__hid, { async: true }).then((r) => r.response), new Promise((r) => setTimeout(() => r("timeout"), 15000))]);
		assertEqual(tok, "10000000-aaaa-bbbb-cccc-000000000001", "hcaptcha test token");
		`
	),
	embed(
		"rv5-embed-turnstile",
		"",
		`<div id="ts"></div>`,
		`
		await loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
		const tok = await new Promise((res, rej) => {
			turnstile.render("#ts", { sitekey: "1x00000000000000000000AA", callback: res, "error-callback": (e) => rej(new Error("turnstile error " + e)) });
			setTimeout(() => rej(new Error("turnstile timeout")), 25000);
		});
		assertEqual(tok, "XXXX.DUMMY.TOKEN.XXXX", "turnstile test token");
		`
	),
	embed(
		"rv5-embed-stripe-elements",
		"",
		`<div id="card"></div>`,
		`
		await loadScript("https://js.stripe.com/v3/");
		const stripe = Stripe("pk_test_TYooMQauvdEDq54NiTphI7jx");
		const el = stripe.elements().create("card");
		const ready = new Promise((res, rej) => { el.on("ready", res); setTimeout(() => rej(new Error("stripe element ready timeout")), 25000); });
		el.mount("#card");
		await ready;
		assert(document.querySelector("#card iframe"), "stripe iframe mounted");
		`
	),
	embed(
		"rv5-embed-paypal-buttons",
		"",
		`<div id="pp"></div>`,
		`
		await loadScript("https://www.paypal.com/sdk/js?client-id=test&currency=USD");
		await paypal.Buttons({ createOrder: () => "x" }).render("#pp");
		await frameLoaded("#pp iframe");
		`
	),
	embed(
		"rv5-embed-twitter-widgets",
		"",
		`<div id="tw"></div>`,
		`
		await loadScript("https://platform.twitter.com/widgets.js");
		await waitFor(() => window.twttr && twttr.widgets && twttr.widgets.createTweet, 15000, "twttr");
		const el = await Promise.race([twttr.widgets.createTweet("20", document.getElementById("tw")), new Promise((r) => setTimeout(() => r("timeout"), 25000))]);
		assertConsistent("tweet element", el && el.tagName ? el.tagName : String(el));
		`
	),
	embed(
		"rv5-embed-google-identity-button",
		"",
		`<div id="gsi"></div>`,
		`
		await loadScript("https://accounts.google.com/gsi/client");
		google.accounts.id.initialize({ client_id: "1234567890-abc.apps.googleusercontent.com", callback: () => {} });
		google.accounts.id.renderButton(document.getElementById("gsi"), { theme: "outline", size: "large" });
		await frameLoaded("#gsi iframe");
		`
	),
	embed(
		"rv5-embed-facebook-sdk",
		"",
		`<div id="fb-root"></div><div class="fb-page" data-href="https://www.facebook.com/facebook" data-width="340"></div>`,
		`
		const inited = new Promise((res) => { window.fbAsyncInit = () => { FB.init({ xfbml: true, version: "v19.0" }); res(); }; });
		await loadScript("https://connect.facebook.net/en_US/sdk.js");
		await inited;
		await waitFor(() => document.querySelector(".fb-page iframe"), 20000, "fb-page iframe");
		`
	),
	embed(
		"rv5-embed-spotify-iframe-api",
		"",
		`<div id="sp"></div>`,
		`
		const ready = new Promise((res) => { window.onSpotifyIframeApiReady = res; });
		await loadScript("https://open.spotify.com/embed/iframe-api/v1");
		const API = await ready;
		const ctl = await new Promise((res) => API.createController(document.getElementById("sp"), { uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC" }, res));
		await new Promise((res, rej) => { ctl.addListener("ready", res); setTimeout(() => rej(new Error("spotify ready timeout")), 25000); });
		`
	),
	embed(
		"rv5-embed-soundcloud-widget",
		"",
		`<iframe id="sc" width="400" height="166" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293"></iframe>`,
		`
		await loadScript("https://w.soundcloud.com/player/api.js");
		const w = SC.Widget(document.getElementById("sc"));
		await new Promise((res, rej) => { w.bind(SC.Widget.Events.READY, res); setTimeout(() => rej(new Error("soundcloud ready timeout")), 25000); });
		`
	),
	embed(
		"rv5-embed-twitch",
		"",
		`<div id="twitch"></div>`,
		`
		await loadScript("https://embed.twitch.tv/embed/v1.js");
		const e = new Twitch.Embed("twitch", { width: 400, height: 300, channel: "twitch", parent: [location.hostname], muted: true });
		await new Promise((res, rej) => { e.addEventListener(Twitch.Embed.VIDEO_READY, res); setTimeout(() => rej(new Error("twitch VIDEO_READY timeout")), 30000); });
		`
	),
	embed(
		"rv5-embed-codepen",
		"",
		`<p class="codepen" data-height="300" data-default-tab="result" data-slug-hash="xxJQvwJ" data-user="chriscoyier">pen</p>`,
		`
		await loadScript("https://cpwebassets.codepen.io/assets/embed/ei.js");
		await frameLoaded("iframe.cp_embed_iframe, iframe[src*=codepen]");
		`
	),
	embed(
		"rv5-embed-gtag-ga4",
		"",
		``,
		`
		window.dataLayer = window.dataLayer || [];
		window.gtag = function () { dataLayer.push(arguments); };
		gtag("js", new Date()); gtag("config", "G-XXXXXXXXXX");
		await loadScript("https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX");
		await waitFor(() => window.google_tag_manager || window.google_tag_data, 15000, "gtm runtime");
		await new Promise((r) => setTimeout(r, 2000));
		`
	),
	embed(
		"rv5-embed-gtm",
		"",
		``,
		`
		window.dataLayer = [{ "gtm.start": Date.now(), event: "gtm.js" }];
		await loadScript("https://www.googletagmanager.com/gtm.js?id=GTM-K9KXPJ4");
		await waitFor(() => window.google_tag_manager, 15000, "google_tag_manager");
		await new Promise((r) => setTimeout(r, 2000));
		`
	),
	embed(
		"rv5-embed-disqus",
		"",
		`<div id="disqus_thread"></div>`,
		`
		window.disqus_config = function () { this.page.url = "https://example.com/post"; this.page.identifier = "rv5"; };
		await loadScript("https://disqus.disqus.com/embed.js");
		await waitFor(() => document.querySelector("#disqus_thread iframe"), 20000, "disqus iframe");
		`
	),
	embed(
		"rv5-embed-instagram",
		"",
		`<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/C1/" data-instgrm-version="14"></blockquote>`,
		`
		await loadScript("https://www.instagram.com/embed.js");
		await waitFor(() => window.instgrm, 15000, "instgrm");
		instgrm.Embeds.process();
		await waitFor(() => document.querySelector("iframe.instagram-media"), 20000, "instagram iframe");
		`
	),
	embed(
		"rv5-embed-hotjar-segment-intercom",
		"",
		``,
		`
		(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:1,hjsv:6};})(window,document);
		await loadScript("https://static.hotjar.com/c/hotjar-1.js?sv=6").catch(() => {});
		window.intercomSettings = { app_id: "abc123" };
		await loadScript("https://widget.intercom.io/widget/abc123").catch(() => {});
		await new Promise((r) => setTimeout(r, 4000));
		assertConsistent("intercom global", typeof window.Intercom);
		`
	),
];

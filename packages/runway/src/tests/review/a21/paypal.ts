import { htmlTest, type Test } from "../../../testcommon.ts";

const t = (name: string, html: string, ms = 50000) => {
	const x = htmlTest({
		name,
		html,
	});
	x.timeoutMs = ms;
	return x;
};

export default [
	t(
		"rv21-real-paypal-buttons",
		`<!doctype html><body><div id="pp" style="width:300px"></div>
	<script>
		runTest(async () => {
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://www.paypal.com/sdk/js?client-id=test&currency=USD"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); setTimeout(() => rej(new Error("sdk load timeout")), 20000); });
			let inited = false;
			const btn = paypal.Buttons({ onInit: () => { inited = true; }, createOrder: () => "x" });
			await Promise.race([btn.render("#pp"), new Promise((_, r) => setTimeout(() => r(new Error("render timeout")), 30000))]);
			await new Promise((r) => setTimeout(r, 3000));
			const f = document.querySelector("#pp iframe");
			assert(f, "button iframe");
			const h = f.getBoundingClientRect().height;
			assert(inited, "onInit called (child->parent zoid/post-robot message)");
			assert(h > 20, "iframe height " + h);
		}, true);
	</script></body>`
	),
	t(
		"rv21-real-gis-button",
		`<!doctype html><body><div id="g"></div>
	<script>
		runTest(async () => {
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); setTimeout(() => rej(new Error("gsi load timeout")), 20000); });
			google.accounts.id.initialize({ client_id: "1234567890-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com", callback: () => {} });
			google.accounts.id.renderButton(document.getElementById("g"), { theme: "outline", size: "large" });
			await new Promise((r) => setTimeout(r, 8000));
			const f = document.querySelector("#g iframe");
			assert(f, "gsi iframe");
			const w = f.getBoundingClientRect().width;
			assert(w > 50, "gsi iframe width (set from child message) " + w);
		}, true);
	</script></body>`
	),
] as Test[];

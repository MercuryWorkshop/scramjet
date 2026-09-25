import http from "http";
import { playwrightTest } from "../../testcommon.ts";

// `Math.random` started from the same seed in every realm, which is what V8's
// `--random-seed` does. Installed before any page script runs, so it is also
// what scramjet's own snapshot of `Math.random` picks up in each of them.
const PIN_MATH_RANDOM = `{
	let seed = 1337;
	Math.random = function random() {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
}`;

const CHILD = `<!DOCTYPE html>
<script>
	addEventListener("message", (e) => {
		if (e.data === "ping") parent.postMessage("pong", "*");
	});
</script>`;

// Two frames and the page itself each post to the page, one after the other,
// and the page names who `e.source` says sent each message. Every one of them
// registered a client of its own, and each is told apart from the others by
// its id alone.
//
// Neither frame's window is touched until both have loaded. Reaching into a
// fresh frame makes the parent install the child's client, drawing from the
// parent's sequence; a frame nothing reaches into - like Turnstile's widget,
// in a closed shadow root - installs its own, drawing from its own.
const TOP = `<!DOCTYPE html>
<body>
<div id="out">pending</div>
<script>
	const out = document.getElementById("out");
	const iframes = [];
	const wins = [];
	const seen = [];
	const name = (source) =>
		source === window ? "self" : wins.indexOf(source) >= 0 ? "frame" + wins.indexOf(source) : "other";

	addEventListener("message", (e) => {
		seen.push(name(e.source));
		if (seen.length < 3) ask(seen.length);
		else out.textContent = seen.join(",");
	});

	const ask = (i) => (i < 2 ? wins[i].postMessage("ping", "*") : postMessage("self", "*"));

	const load = (i) => {
		if (i === 2) {
			for (const iframe of iframes) wins.push(iframe.contentWindow);
			return ask(0);
		}
		const iframe = document.createElement("iframe");
		iframe.src = "/child";
		iframe.onload = () => load(i + 1);
		document.body.append(iframe);
		iframes.push(iframe);
	};
	load(0);
</script>`;

export default [
	playwrightTest({
		name: "postmessage-client-ids-pinned-random",
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(req.url === "/child" ? CHILD : TOP);
			});
			await new Promise<void>((resolve) => server.listen(0, resolve));
			const port = (server.address() as { port: number }).port;

			const cdp = await page.context().newCDPSession(page);
			await cdp.send("Page.enable");
			const { identifier } = await cdp.send(
				"Page.addScriptToEvaluateOnNewDocument",
				{ source: PIN_MATH_RANDOM }
			);

			try {
				await navigate(`http://localhost:${port}/`);

				const out = frame.locator("#out");
				await out.filter({ hasNotText: "pending" }).waitFor({ timeout: 10000 });
				const seen = await out.textContent();
				if (seen !== "frame0,frame1,self") {
					throw new Error(
						`e.source named ${seen}, expected frame0,frame1,self`
					);
				}
			} finally {
				await cdp
					.send("Page.removeScriptToEvaluateOnNewDocument", { identifier })
					.catch(() => {});
				await cdp.detach().catch(() => {});
				server.close();
			}
		},
	}),
];

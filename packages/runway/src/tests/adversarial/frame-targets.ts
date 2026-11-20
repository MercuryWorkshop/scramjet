import http from "http";
import { playwrightTest } from "../../testcommon.ts";

// The guest creates its iframe from script - Google's apps menu does - so the
// iframe's URL carries the frame names its `_top` and `_parent` resolve to.
const guestPage = (rename: boolean) => `<!DOCTYPE html>
<p id="home">home</p>
<script>
	${rename ? 'window.name = "renamed-by-the-page";' : ""}
	const frame = document.createElement("iframe");
	frame.name = "app";
	frame.src = "/menu";
	document.body.append(frame);
</script>`;

const PAGES: Record<string, string> = {
	"/menu": `<!DOCTYPE html>
<a id="top" href="/landed?top" target="_top">top</a>
<a id="parent" href="/landed?parent" target="_parent">parent</a>`,
	"/landed?top": `<!DOCTYPE html><p id="landed">top</p>`,
	"/landed?parent": `<!DOCTYPE html><p id="landed">parent</p>`,
};

// `_top` and `_parent` name the guest's outermost frame, which is the page as
// far as the guest knows. Following one navigates that frame. A target that
// names no frame makes the browser open a new window instead, which is how
// this fails.
//
// The page may rename its own window, and a browser resolves the target by the
// new name, so the rewrite has to follow it.
const targetTest = (target: "top" | "parent", rename = false) =>
	playwrightTest({
		name: `frame-target-${target}-navigates-the-guest${rename ? "-after-rename" : ""}`,
		fn: async ({ page, frame, navigate }) => {
			const server = http.createServer((req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(
					req.url === "/" ? guestPage(rename) : (PAGES[req.url ?? ""] ?? "")
				);
			});
			await new Promise<void>((resolve) => server.listen(0, resolve));
			const port = (server.address() as { port: number }).port;

			const opened: string[] = [];
			const onPage = (p: { url(): string }) => opened.push(p.url());
			page.context().on("page", onPage);

			try {
				await navigate(`http://localhost:${port}/`);
				const link = frame
					.frameLocator("iframe[name='app']")
					.locator(`#${target}`);
				await link.waitFor({ timeout: 10000 });
				await link.click();

				await frame.locator("#landed").waitFor({ timeout: 10000 });
				const landed = await frame.locator("#landed").textContent();
				if (landed !== target) {
					throw new Error(`the guest landed on ${landed}, expected ${target}`);
				}
				if (opened.length) {
					throw new Error(`a new window opened: ${opened.join(", ")}`);
				}
			} finally {
				// the harness reuses this frame, and its name outlives the page
				if (rename) {
					await page.evaluate(() => {
						const frame = document.getElementById(
							"testframe"
						) as HTMLIFrameElement;
						frame.contentWindow!.name = frame.getAttribute("name") ?? "";
					});
				}
				page.context().off("page", onPage);
				for (const p of page.context().pages()) {
					if (p !== page) await p.close().catch(() => {});
				}
				server.close();
			}
		},
	});

export default [
	targetTest("top"),
	targetTest("parent"),
	targetTest("top", true),
	targetTest("parent", true),
];

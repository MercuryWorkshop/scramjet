import { playwrightTest } from "../../../testcommon.ts";
import http from "node:http";

let port = 0;
const srv = http.createServer((req, res) => {
	if (req.url!.startsWith("/page")) {
		res.writeHead(200, {
			"Content-Type": "text/html",
		});
		res.end(`<!doctype html><body>
			<div id=src contenteditable><a href="/link" target="_blank">link</a> <span style="color: rgb(255, 0, 0); background-image: url(/bg.png)">styled</span> <img src="/i.png" width=5 height=5> <b onclick="x()">bold</b></div>
			<div id=dst contenteditable></div>
			<div id=log></div>
			<script>
				window.pasted = null;
				document.getElementById('dst').addEventListener('paste', e => { window.pasted = e.clipboardData.getData('text/html'); });
			</script></body>`);
	} else {
		res.writeHead(200, {
			"Content-Type": "image/png",
		});
		res.end();
	}
});
srv.listen(0, () => {
	port = (srv.address() as any).port;
});

async function run(frameOrPage: any, page: any) {
	await frameOrPage.locator("#src").click();
	await frameOrPage.locator("#src").evaluate((el: any) => {
		const r = document.createRange();
		r.selectNodeContents(el);
		const s = getSelection()!;
		s.removeAllRanges();
		s.addRange(r);
	});
	await page.keyboard.press("Control+C");
	await frameOrPage.locator("#dst").click();
	await page.keyboard.press("Control+V");
	await page.waitForTimeout(300);
	return await frameOrPage.locator("#dst").evaluate((el: any) => {
		const a = el.querySelector("a"),
			sp = el.querySelector("span"),
			img = el.querySelector("img"),
			b = el.querySelector("b");
		return {
			clipHtml:
				(window as any).pasted &&
				(window as any).pasted
					.replace(
						/<!--StartFragment-->|<!--EndFragment-->|<html>|<\/html>|<body>|<\/body>/g,
						""
					)
					.replace(/localhost:\d+/g, "HOST")
					.slice(0, 900),
			innerHTML: el.innerHTML.replace(/localhost:\d+/g, "HOST").slice(0, 900),
			a: a && [
				a.getAttribute("href"),
				a.href.replace(/localhost:\d+/g, "HOST"),
				a.getAttribute("target"),
			],
			spanStyle: sp && [
				sp.getAttribute("style"),
				sp.style.backgroundImage.replace(/localhost:\d+/g, "HOST"),
			],
			img: img && [
				img.getAttribute("src"),
				img.src.replace(/localhost:\d+/g, "HOST"),
			],
			b: b && [b.getAttribute("onclick"), b.outerHTML],
			attrNames: Array.from(el.querySelectorAll("*")).map(
				(e: any) => e.tagName + ":" + e.getAttributeNames().join(",")
			),
		};
	});
}

export default [
	playwrightTest({
		name: "rv11-clipboard-copy-paste",
		fn: async ({ page, frame, navigate }) => {
			await page
				.context()
				.grantPermissions(["clipboard-read", "clipboard-write"]);
			await navigate(`http://localhost:${port}/page`);
			await frame.locator("#dst").waitFor();
			const sj = await run(frame, page);
			const bp = await page.context().newPage();
			await bp.goto(`http://localhost:${port}/page`);
			const bare = await run(bp, bp);
			await bp.close();
			console.log(
				"RV11PROBE " +
					JSON.stringify({
						"rv11-clipboard-copy-paste": sj,
					}) +
					" | bare: RV11PROBE " +
					JSON.stringify({
						"rv11-clipboard-copy-paste": bare,
					})
			);
			throw new Error("probe");
		},
	}),
];

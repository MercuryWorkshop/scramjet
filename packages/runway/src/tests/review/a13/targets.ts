import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// Navigation targets that the `target` rule (htmlRules: a, base only) does not
// cover: form target, area target, button/input formtarget, keyword case
// (`_TOP`). Each case: load the page in the proxied frame, activate it, and see
// whether the harness (the real top window) got navigated away.

const CASES: Record<string, string> = {
	"a-top": `<a id=go href="/landed?c=a-top" target="_top">go</a>`,
	"a-TOP": `<a id=go href="/landed?c=a-TOP" target="_TOP">go</a>`,
	"a-Top-js": `<a id=go href="/landed?c=a-Top-js">go</a><script>go.setAttribute("target", "_Top")</script>`,
	"area-top": `<map name=m><area id=go shape=default href="/landed?c=area-top" target="_top"></map><img usemap="#m" width=50 height=50 src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`,
	"form-top": `<form action="/landed" target="_top"><input type=hidden name=c value=form-top><button id=go>go</button></form>`,
	"formtarget-top": `<form action="/landed"><input type=hidden name=c value=formtarget-top><button id=go formtarget="_top">go</button></form>`,
	"base-target-top": `<base target="_top"><a id=go href="/landed?c=base-target-top">go</a>`,
	"base-target-TOP": `<base target="_TOP"><a id=go href="/landed?c=base-target-TOP">go</a>`,
	"svg-a-top": `<svg width=50 height=50><a id=go href="/landed?c=svg-a-top" target="_top"><rect width=50 height=50 /></a></svg>`,
	"svg-a-target-baseVal": `<svg width=50 height=50><a id=go href="/landed?c=svg-a-target-baseVal"><rect width=50 height=50 /></a></svg><script>document.getElementById("go").target.baseVal = "_top"</script>`,
	"a-target-prop": `<a id=go href="/landed?c=a-target-prop">go</a><script>document.getElementById("go").target = "_top"</script>`,
	"a-parent-in-top": `<a id=go href="/landed?c=a-parent-in-top" target="_parent">go</a>`,
	"a-PARENT-in-top": `<a id=go href="/landed?c=a-PARENT-in-top" target="_PARENT">go</a>`,
	"form-parent-in-top": `<form action="/landed" target="_parent"><input type=hidden name=c value=form-parent-in-top><button id=go>go</button></form>`,
};

export default Object.entries(CASES).map(([name, body]) =>
	Object.assign(
		playwrightTest({
			name: `rv13-target-${name}`,
			fn: async ({ page, frame, navigate }) => {
				const server = http.createServer((req, res) => {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					if (req.url!.startsWith("/landed"))
						res.end(`<!doctype html><title>landed</title>landed ${req.url}`);
					else res.end(`<!doctype html><body>${body}</body>`);
				});
				await new Promise<void>((r) => server.listen(0, r));
				const port = (server.address() as any).port;
				try {
					await navigate(`http://localhost:${port}/`);
					await new Promise((r) => setTimeout(r, 800));
					const harness = page.url();
					await frame.locator("#go").click({
						force: true,
					});
					await new Promise((r) => setTimeout(r, 2000));
					const top = page.url();
					let inFrame = "n/a";
					try {
						inFrame = (
							await frame.locator("body").innerText({
								timeout: 1000,
							})
						).slice(0, 80);
					} catch (e) {
						inFrame = "ERR";
					}
					const escaped = top !== harness;
					console.log(
						`RV13TARGET ${name} escaped=${escaped} top=${top.slice(0, 120)} frame=${JSON.stringify(inFrame)}`
					);
					if (escaped) throw new Error(`real top navigated: ${top}`);
				} finally {
					server.close();
				}
			},
		}),
		{
			reloadHarness: true,
		}
	)
);

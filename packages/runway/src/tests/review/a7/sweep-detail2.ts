import { playwrightTest } from "../../../testcommon.ts";

const sites: [string, string][] = [
	["pydocs-search", "https://docs.python.org/3/search.html?q=list"],
	[
		"pydocs-hl",
		"https://docs.python.org/3/library/stdtypes.html?highlight=list",
	],
	["pydocs-idx", "https://docs.python.org/3/"],
];

export default sites.map(([name, url]) =>
	Object.assign(
		playwrightTest({
			name: `rv7-detail2-${name}`,
			fn: async ({ page, frame, navigate }) => {
				const out: string[] = [];
				const onErr = (e: Error) =>
					out.push("PAGEERROR " + String(e.stack || e.message).slice(0, 1500));
				const onCon = async (m: any) => {
					if (m.type() !== "error" && m.type() !== "warning") return;
					const t = m.text();
					if (/%c|Refused|scramjet|Error/.test(t)) {
						let args = "";
						try {
							args = (
								await Promise.all(
									m
										.args()
										.map((a: any) =>
											a
												.evaluate((v: any) =>
													v && v.stack ? v.stack : String(v)
												)
												.catch(() => "?")
										)
								)
							).join(" | ");
						} catch {}
						out.push(
							"CONSOLE " +
								m.type() +
								" " +
								t.slice(0, 400) +
								" ARGS " +
								args.slice(0, 1500) +
								" LOC " +
								JSON.stringify(m.location())
						);
					}
				};
				const onResp = async (r: any) => {
					if (/Refused/.test("")) return;
					const ct = r.headers()["content-type"] || "";
					if (
						r.request().resourceType() === "script" &&
						!/javascript|ecmascript/.test(ct)
					)
						out.push(
							"SCRIPTMIME " +
								r.status() +
								" " +
								ct +
								" " +
								r.url().slice(0, 300)
						);
				};
				page.on("pageerror", onErr);
				page.on("console", onCon);
				page.on("response", onResp);
				try {
					await navigate(url);
					await new Promise((r) => setTimeout(r, 12000));
					const facts = await frame
						.locator("body")
						.evaluate(() => ({
							n: document.querySelectorAll("*").length,
							text: (document.body.innerText || "").slice(0, 200),
						}))
						.catch((e) => "ERR " + e.message.slice(0, 200));
					console.log(
						`RV7DETAIL ${name} ` +
							JSON.stringify(
								{
									facts,
									out: out.slice(0, 40),
								},
								null,
								1
							)
					);
				} finally {
					page.off("pageerror", onErr);
					page.off("console", onCon);
					page.off("response", onResp);
				}
			},
		}),
		{
			timeoutMs: 90000,
			reloadHarness: true,
		}
	)
);

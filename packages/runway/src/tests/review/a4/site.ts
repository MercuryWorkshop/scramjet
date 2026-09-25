import { playwrightTest } from "../../../testcommon.ts";

export default [
	playwrightTest({
		name: "rv4-site-echo-ws",
		fn: async ({ page, frame, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) => errs.push(String(e)));
			await navigate("https://echo.websocket.org/.ws");
			await frame
				.locator("text=/Request served by/i")
				.first()
				.waitFor({
					timeout: 20000,
				})
				.catch(() => {});
			const txt = (await frame.locator("body").textContent()) || "";
			if (!/Request served by/i.test(txt))
				throw new Error(
					"echo ws page didn't get server message: " +
						txt.slice(0, 300) +
						" errs=" +
						errs.join("|")
				);
		},
	}),
	playwrightTest({
		name: "rv4-site-discord-qr",
		fn: async ({ page, frame, navigate }) => {
			const errs: string[] = [];
			page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
			await navigate("https://discord.com/login");
			try {
				await frame
					.locator('[class*="qrCode"] svg, [class*="qrCodeContainer"] svg')
					.first()
					.waitFor({
						state: "visible",
						timeout: 40000,
					});
			} catch (e) {
				throw new Error(
					"no QR (remote-auth websocket) errs=" + errs.join(" | ")
				);
			}
		},
	}),
];

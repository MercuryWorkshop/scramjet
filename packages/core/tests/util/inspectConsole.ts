import { Page } from "@playwright/test";

export function registerInspect(page: Page) {
	let hasOxcError = false;
	let hasScramjetError = false;
	page.on("console", async (msg) => {
		if (msg.type() === "error") {
			if (msg.text().includes("oxc parse error") && !hasOxcError) {
				hasOxcError = true;
				console.log("OXC parse error detected! Please review manually.");
			} else if (
				msg.text().includes("ERROR FROM SCRAMJET INTERNALS") &&
				!hasScramjetError
			) {
				hasScramjetError = true;
				console.log("Scramjet error detected! Please review manually.");
			}
		}
	});
}

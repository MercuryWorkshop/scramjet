import { test, expect } from "@playwright/test";
import { setupPage } from "../../util/setupPage";

test.describe("Google", () => {
	test("The front page can load.", async ({ page }) => {
		const frame = await setupPage(page, "https://www.google.com/");

		const search = await frame
			.locator("textarea[Title='Search']")
			.first()
			.waitFor({ state: "visible" });
		expect(search).not.toBeNull();
	});

	test("The Google Apps menu opens and content is visible.", async ({
		page,
	}) => {
		const frame = await setupPage(page, "https://www.google.com/");

		frame.locator("a[aria-label='Google apps']").first().click();

		const appsMenuFrame = frame.locator("iframe[name='app']");
		await appsMenuFrame.waitFor({ state: "visible" });

		await appsMenuFrame
			.contentFrame()
			.locator("c-wiz")
			.first()
			.waitFor({ state: "visible" });

		const appsMenu = await appsMenuFrame.getAttribute("src");

		expect(appsMenu).not.toBeNull();
	});
});

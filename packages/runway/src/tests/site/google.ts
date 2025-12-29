import { playwrightTest } from "../../testcommon.ts";

export default [
	playwrightTest({
		name: "site-google-frontpage",
		fn: async ({ frame, navigate }) => {
			await navigate("https://www.google.com/");

			// Wait for the search box to be visible
			const search = frame.locator("textarea[title='Search']").first();
			await search.waitFor({ state: "visible", timeout: 30000 });
		},
	}),

	playwrightTest({
		name: "site-google-apps-menu",
		fn: async ({ frame, navigate }) => {
			await navigate("https://www.google.com/");

			// Click on Google Apps button
			const appsButton = frame.locator("a[aria-label='Google apps']").first();
			await appsButton.waitFor({ state: "visible", timeout: 30000 });
			await appsButton.click();

			// Wait for the apps menu iframe to appear
			const appsMenuFrame = frame.locator("iframe[name='app']");
			await appsMenuFrame.waitFor({ state: "visible", timeout: 30000 });

			// Wait for content inside the apps menu iframe
			await appsMenuFrame
				.contentFrame()
				.locator("c-wiz")
				.first()
				.waitFor({ state: "visible", timeout: 30000 });
		},
	}),
];

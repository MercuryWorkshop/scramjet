import { defineConfig, devices } from "@playwright/test";
import type { GitHubActionOptions } from "@estruyf/github-actions-reporter";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests/integration/site",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 2,
	reporter: process.env.CI
		? [
				[
					"@estruyf/github-actions-reporter",
					{
						title: "Test summary",
						useDetails: true,
						showError: true,
					} as GitHubActionOptions,
				],
				["github"],
			]
		: "html",
	timeout: 20000,
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",
		actionTimeout: 10000,
		baseURL: "http://localhost:1337",
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		// {
		//   name: "firefox",
		//   use: { ...devices["Desktop Firefox"] },
		// },
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: "pnpm run dev",
		url: "http://127.0.0.1:1337",
		reuseExistingServer: false,
	},
});

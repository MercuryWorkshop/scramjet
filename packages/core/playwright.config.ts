import {
	defineConfig,
	devices,
	type ReporterDescription,
} from "@playwright/test";
import type { GitHubActionOptions } from "@estruyf/github-actions-reporter";

const reporters: ReporterDescription[] = [
	["blob", { fileName: "test-results.zip" }],
	["html"],
];
if (process.env.CI) {
	reporters.pop();
	reporters.push(["github"]);
	reporters.push([
		"@estruyf/github-actions-reporter",
		{
			title: "Test summary",
			useDetails: true,
			showError: true,
		} as GitHubActionOptions,
	]);
}
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests/integration/site",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 2,
	reporter: reporters,
	timeout: 20000,
	use: {
		trace: "on",
		actionTimeout: 10000,
		baseURL: "http://localhost:4141",
	},
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
	webServer: {
		command: "cd .. && pnpm run dev",
		url: "http://localhost:4141",
		reuseExistingServer: false,
	},
});

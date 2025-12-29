import { chromium } from "playwright";
import type { Page, Browser } from "playwright";
import type { Test } from "./testcommon.ts";
import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

// GitHub Actions annotation helpers
function ghaError(message: string, file?: string, line?: number) {
	if (!isGitHubActions) return;
	const params = [file && `file=${file}`, line && `line=${line}`]
		.filter(Boolean)
		.join(",");
	console.log(`::error ${params}::${message.replace(/\n/g, "%0A")}`);
}

function ghaGroup(name: string) {
	if (!isGitHubActions) return;
	console.log(`::group::${name}`);
}

function ghaEndGroup() {
	if (!isGitHubActions) return;
	console.log(`::endgroup::`);
}

type TestResult = {
	status: "pass" | "fail";
	message?: string;
	details?: any;
};

type TestRunResult = {
	test: Test;
	result: TestResult | { status: "error"; message: string };
	duration: number;
};

async function discoverTests(): Promise<Test[]> {
	const testFiles = glob("**/*.ts", {
		cwd: path.join(__dirname, "tests"),
	});

	const tests: Test[] = [];
	for await (const file of testFiles) {
		const fullPath = path.join(__dirname, "tests", file);
		const module = await import(fullPath);
		if (module.default) {
			// Handle both single test and array of tests
			if (Array.isArray(module.default)) {
				tests.push(...module.default);
			} else {
				tests.push(module.default);
			}
		}
	}
	return tests;
}

async function createTestPage(browser: Browser): Promise<{
	page: Page;
	waitForResult: (timeout: number) => Promise<TestResult>;
	cleanup: () => void;
}> {
	const page = await browser.newPage();

	let resolveResult: (result: TestResult) => void;
	let rejectResult: (error: Error) => void;
	let timeoutId: NodeJS.Timeout | null = null;
	let resultPromise: Promise<TestResult>;

	const resetPromise = () => {
		resultPromise = new Promise<TestResult>((resolve, reject) => {
			resolveResult = resolve;
			rejectResult = reject;
		});
	};
	resetPromise();

	// Expose test reporting functions (can only do this once per page)
	await page.exposeFunction("__testPass", (message?: string, details?: any) => {
		if (timeoutId) clearTimeout(timeoutId);
		resolveResult({ status: "pass", message, details });
		resetPromise();
	});

	await page.exposeFunction("__testFail", (message?: string, details?: any) => {
		if (timeoutId) clearTimeout(timeoutId);
		resolveResult({ status: "fail", message, details });
		resetPromise();
	});

	// Catch uncaught errors
	page.on("pageerror", (error) => {
		if (timeoutId) clearTimeout(timeoutId);
		resolveResult({
			status: "fail",
			message: `Uncaught error: ${error.message}`,
			details: error.stack,
		});
		resetPromise();
	});

	return {
		page,
		waitForResult: (timeout: number) => {
			timeoutId = setTimeout(() => {
				rejectResult(new Error(`Test timed out after ${timeout}ms`));
				resetPromise();
			}, timeout);
			return resultPromise;
		},
		cleanup: () => {
			if (timeoutId) clearTimeout(timeoutId);
		},
	};
}

async function runTest(
	page: Page,
	waitForResult: (timeout: number) => Promise<TestResult>,
	test: Test,
	timeout: number = 30000
): Promise<TestResult> {
	// Handle playwright tests (tests that control the browser directly)
	if (test.playwrightFn) {
		const frame = page.frameLocator("#testframe");
		const navigate = async (url: string) => {
			await page.evaluate((u) => {
				(window as any).__runwayNavigate(u);
			}, url);
		};

		try {
			await test.playwrightFn({ page, frame, navigate });
			return { status: "pass" };
		} catch (error) {
			return {
				status: "fail",
				message: error instanceof Error ? error.message : String(error),
				details: error instanceof Error ? error.stack : undefined,
			};
		}
	}

	// Handle basic tests (tests that serve a page and call pass/fail)
	await test.start();

	try {
		const testUrl = `http://localhost:${test.port}/`;
		await page.evaluate((url) => {
			// This function should be defined by the harness
			(window as any).__runwayNavigate(url);
		}, testUrl);

		return await waitForResult(timeout);
	} finally {
		await test.stop();
	}
}

// Main runner
async function main() {
	console.log("🚀 Starting Runway test runner\n");

	// Start the harness server (scramjet proxy)
	const { startHarness, PORT: HARNESS_PORT } = await import(
		"./harness/scramjet/index.ts"
	);
	await startHarness();
	const harnessUrl = `http://localhost:${HARNESS_PORT}`;
	console.log(`📡 Harness running at ${harnessUrl}\n`);

	const tests = await discoverTests();
	console.log(`📋 Found ${tests.length} test(s)\n`);

	const browser = await chromium.launch({
		headless: process.env.HEADED !== "1",
	});

	const results: TestRunResult[] = [];
	let testPage = await createTestPage(browser);
	let needsReload = true;

	for (const test of tests) {
		ghaGroup(`Test: ${test.name}`);
		process.stdout.write(`  ${test.name} ... `);

		// Reload page if needed (first run or after failure)
		if (needsReload) {
			testPage.cleanup();
			if (!testPage.page.isClosed()) await testPage.page.close();
			testPage = await createTestPage(browser);
			await testPage.page.goto(harnessUrl);

			// Wait for harness to be ready with timeout
			try {
				await testPage.page.waitForFunction(
					() => typeof (window as any).__runwayNavigate === "function",
					{ timeout: 30000 }
				);
			} catch (e) {
				// Check if harness had an error
				const statusText = await testPage.page.evaluate(() => {
					const el = document.getElementById("status");
					return el?.textContent || "";
				});
				console.error(
					`\n💥 FATAL: Harness failed to initialize: ${statusText}`
				);
				console.error(
					"   Check that scramjet is built and all dependencies are available.\n"
				);
				ghaError(`Harness failed to initialize: ${statusText}`);
				await browser.close();
				process.exit(1);
			}
			needsReload = false;
		}

		const start = Date.now();
		try {
			const result = await runTest(testPage.page, testPage.waitForResult, test);
			const duration = Date.now() - start;
			results.push({ test, result, duration });

			if (result.status === "pass") {
				console.log(`✅ passed (${duration}ms)`);
			} else {
				console.log(`❌ failed (${duration}ms)`);
				if (result.message) {
					console.log(`     ${result.message}`);
				}
				ghaError(
					`Test "${test.name}" failed: ${result.message || "Unknown error"}`
				);
				needsReload = true; // Reload after failure
			}
		} catch (error) {
			const duration = Date.now() - start;
			results.push({
				test,
				result: {
					status: "error",
					message: error instanceof Error ? error.message : String(error),
				},
				duration,
			});
			console.log(`💥 error (${duration}ms)`);
			console.log(
				`     ${error instanceof Error ? error.message : String(error)}`
			);
			ghaError(
				`Test "${test.name}" error: ${error instanceof Error ? error.message : String(error)}`
			);
			needsReload = true; // Reload after error
		}
		ghaEndGroup();
	}

	testPage.cleanup();
	await browser.close();

	// Summary
	console.log("\n" + "─".repeat(50));
	const passed = results.filter((r) => r.result.status === "pass").length;
	const failed = results.filter((r) => r.result.status === "fail").length;
	const errors = results.filter((r) => r.result.status === "error").length;

	console.log(
		`\n✅ ${passed} passed | ❌ ${failed} failed | 💥 ${errors} errors\n`
	);

	process.exit(failed + errors > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});

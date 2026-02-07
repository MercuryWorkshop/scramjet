import { chromium } from "playwright";
import type { Page, Browser } from "playwright";
import type { Test } from "./testcommon.ts";
import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { CDP_INIT_SCRIPT } from "./cdp-init.ts";

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

type HarnessKind = "scramjet" | "bare";

type ConsistencyIssue = {
	label: string;
	scramjet?: any;
	bare?: any;
	reason: string;
};

function createConsistencyTracker(requireBoth: boolean) {
	const entries = new Map<
		string,
		{
			values: Partial<Record<HarnessKind, any>>;
			promise: Promise<void>;
			resolve: () => void;
			reject: (error: Error) => void;
			settled: boolean;
		}
	>();
	const issues: ConsistencyIssue[] = [];

	const getEntry = (label: string) => {
		let entry = entries.get(label);
		if (!entry) {
			let resolve!: () => void;
			let reject!: (error: Error) => void;
			const promise = new Promise<void>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			entry = {
				values: {},
				promise,
				resolve,
				reject,
				settled: false,
			};
			entries.set(label, entry);
		}
		return entry;
	};

	const handle = async (source: HarnessKind, label: string, value: any) => {
		if (!requireBoth) return;
		const safeLabel = label || "default";
		const entry = getEntry(safeLabel);
		entry.values[source] = value;

		if (
			!entry.settled &&
			"scramjet" in entry.values &&
			"bare" in entry.values
		) {
			const scramjetValue = entry.values.scramjet;
			const bareValue = entry.values.bare;
			if (!isDeepStrictEqual(scramjetValue, bareValue)) {
				entry.settled = true;
				issues.push({
					label: safeLabel,
					scramjet: scramjetValue,
					bare: bareValue,
					reason: "Values differ",
				});
				entry.reject(new Error(`assertConsistent mismatch for "${safeLabel}"`));
			} else {
				entry.settled = true;
				entry.resolve();
			}
		}
		return entry.promise;
	};

	const finalize = async (timeout: number) => {
		if (!requireBoth) return { status: "pass" as const };
		const promises = [...entries.values()].map((entry) => entry.promise);
		if (promises.length === 0) return { status: "pass" as const };

		let timedOut = false;
		try {
			await Promise.race([
				Promise.allSettled(promises),
				new Promise<void>((_, reject) => {
					setTimeout(() => {
						timedOut = true;
						reject(new Error("Consistency checks timed out"));
					}, timeout);
				}),
			]);
		} catch {
			// handled below
		}

		if (timedOut) {
			for (const [label, entry] of entries) {
				if (!entry.settled) {
					issues.push({
						label,
						scramjet: entry.values.scramjet,
						bare: entry.values.bare,
						reason: "Timed out waiting for both values",
					});
				}
			}
		}

		if (issues.length > 0) {
			return {
				status: "fail" as const,
				message: `assertConsistent failed (${issues.length} mismatch${
					issues.length === 1 ? "" : "es"
				})`,
				details: issues,
			};
		}

		return { status: "pass" as const };
	};

	return { handle, finalize };
}

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

async function createTestPage(
	browser: Browser,
	options: {
		name: HarnessKind;
		onConsistent?: (
			source: HarnessKind,
			label: string,
			value: any
		) => Promise<void>;
	}
): Promise<{
	page: Page;
	waitForResult: (timeout: number) => Promise<TestResult>;
	cleanup: () => void;
}> {
	const page = await browser.newPage();
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Page.enable");
	await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
		source: CDP_INIT_SCRIPT,
	});

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

	await page.exposeFunction(
		"__testConsistent",
		async (label: string, value?: any) => {
			if (typeof value === "undefined") {
				value = label;
				label = "default";
			}
			if (options.onConsistent) {
				return options.onConsistent(options.name, label, value);
			}
		}
	);

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

async function runTestOnHarness(
	page: Page,
	waitForResult: (timeout: number) => Promise<TestResult>,
	test: Test,
	serverResult: Promise<TestResult> | null,
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

	const testUrl = `http://localhost:${test.port}/`;
	await page.evaluate((url) => {
		// This function should be defined by the harness
		(window as any).__runwayNavigate(url);
	}, testUrl);

	if (serverResult) {
		return await Promise.race([waitForResult(timeout), serverResult]);
	}

	return await waitForResult(timeout);
}

// Main runner
async function main() {
	console.log("🚀 Starting Runway test runner\n");

	// Start the harness servers
	const { startHarness, PORT: HARNESS_PORT } = await import(
		"./harness/scramjet/index.ts"
	);
	const { startBareHarness, BARE_PORT } = await import(
		"./harness/bare/index.ts"
	);
	await startHarness();
	await startBareHarness();
	const scramjetUrl = `http://localhost:${HARNESS_PORT}`;
	const bareUrl = `http://localhost:${BARE_PORT}`;
	console.log(`📡 Scramjet harness running at ${scramjetUrl}`);
	console.log(`📡 Bare harness running at ${bareUrl}\n`);

	const allTests = await discoverTests();

	// Filter tests if a pattern is provided
	const testFilter = process.argv[2];
	const tests = testFilter
		? allTests.filter((t) => t.name.includes(testFilter))
		: allTests;

	if (testFilter) {
		console.log(`� Filter: "${testFilter}"`);
	}
	console.log(
		`�📋 Found ${tests.length} test(s)${testFilter ? ` (${allTests.length} total)` : ""}\n`
	);

	if (tests.length === 0) {
		console.log(
			`❌ No tests found${testFilter ? ` matching "${testFilter}"` : ""}`
		);
		process.exit(1);
	}

	const browser = await chromium.launch({
		headless: process.env.HEADED !== "1",
	});

	const results: TestRunResult[] = [];
	let consistencyHandler: (
		source: HarnessKind,
		label: string,
		value: any
	) => Promise<void> = async () => {};
	const createPages = async () => ({
		scramjet: await createTestPage(browser, {
			name: "scramjet",
			onConsistent: (source, label, value) =>
				consistencyHandler(source, label, value),
		}),
		bare: await createTestPage(browser, {
			name: "bare",
			onConsistent: (source, label, value) =>
				consistencyHandler(source, label, value),
		}),
	});
	let testPages = await createPages();
	let needsReload = true;

	const ensureHarnessReady = async (page: Page, url: string, label: string) => {
		await page.goto(url);
		try {
			await page.waitForFunction(
				() => typeof (window as any).__runwayNavigate === "function",
				{ timeout: 30000 }
			);
		} catch {
			const statusText = await page.evaluate(() => {
				const el = document.getElementById("status");
				return el?.textContent || "";
			});
			console.error(
				`\n💥 FATAL: ${label} harness failed to initialize: ${statusText}`
			);
			console.error(
				"   Check that scramjet is built and all dependencies are available.\n"
			);
			ghaError(`Harness failed to initialize: ${label}: ${statusText}`);
			await browser.close();
			process.exit(1);
		}
	};

	for (const test of tests) {
		ghaGroup(`Test: ${test.name}`);
		process.stdout.write(`  ${test.name} ... `);

		const consistencyTracker = createConsistencyTracker(!test.scramjetOnly);
		consistencyHandler = consistencyTracker.handle;

		// Reload pages if needed (first run or after failure)
		if (needsReload) {
			testPages.scramjet.cleanup();
			testPages.bare.cleanup();
			if (!testPages.scramjet.page.isClosed())
				await testPages.scramjet.page.close();
			if (!testPages.bare.page.isClosed()) await testPages.bare.page.close();
			testPages = await createPages();
			await ensureHarnessReady(
				testPages.scramjet.page,
				scramjetUrl,
				"Scramjet"
			);
			await ensureHarnessReady(testPages.bare.page, bareUrl, "Bare");
			needsReload = false;
		}

		const start = Date.now();
		let started = false;
		try {
			let serverResult: Promise<TestResult> | null = null;
			let serverResultResolve: (result: TestResult) => void = () => {};

			if (!test.playwrightFn) {
				serverResult = new Promise<TestResult>((resolve) => {
					serverResultResolve = resolve;
				});
				await test.start({
					pass: async (message?: string, details?: any) =>
						serverResultResolve({ status: "pass", message, details }),
					fail: async (message?: string, details?: any) =>
						serverResultResolve({ status: "fail", message, details }),
				});
				started = true;
			}

			const scramjetPromise = runTestOnHarness(
				testPages.scramjet.page,
				testPages.scramjet.waitForResult,
				test,
				serverResult
			);
			const barePromise = test.scramjetOnly
				? null
				: runTestOnHarness(
						testPages.bare.page,
						testPages.bare.waitForResult,
						test,
						serverResult
					);

			const [scramjetResult, bareResult] = test.scramjetOnly
				? [await scramjetPromise, null]
				: await Promise.all([scramjetPromise, barePromise!]);

			const consistencyResult = await consistencyTracker.finalize(30000);

			let result: TestResult;
			if (test.scramjetOnly) {
				result = scramjetResult;
			} else if (
				scramjetResult.status !== "pass" ||
				bareResult!.status !== "pass"
			) {
				const failures: string[] = [];
				if (scramjetResult.status !== "pass") {
					failures.push(
						`scramjet: ${scramjetResult.message || scramjetResult.status}`
					);
				}
				if (bareResult!.status !== "pass") {
					failures.push(`bare: ${bareResult!.message || bareResult!.status}`);
				}
				result = {
					status: "fail",
					message: failures.join(" | "),
					details: { scramjet: scramjetResult, bare: bareResult },
				};
			} else if (consistencyResult.status === "fail") {
				result = {
					status: "fail",
					message: consistencyResult.message,
					details: consistencyResult.details,
				};
			} else {
				result = { status: "pass" };
			}

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
		} finally {
			if (!test.playwrightFn && started) {
				await test.stop();
			}
		}
		ghaEndGroup();
	}

	testPages.scramjet.cleanup();
	testPages.bare.cleanup();
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

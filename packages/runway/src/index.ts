import { chromium } from "playwright";
import type { Page, Browser, BrowserContext } from "playwright";
import type { Test } from "./testcommon.ts";
import { glob, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { setupRunwayPageBindings } from "./cdp-page.ts";
import v8toIstanbul from "v8-to-istanbul";
import istanbulCoverage from "istanbul-lib-coverage";

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
	console.log("::endgroup::");
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

type ExpectedFailingTestsFile = {
	tests: string[];
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
	const omitWpt = process.env.OMIT_WPT === "1";
	const testFiles = glob("**/*.ts", {
		cwd: path.join(__dirname, "tests"),
	});

	const tests: Test[] = [];
	for await (const file of testFiles) {
		if (omitWpt && file.startsWith("wpt/")) {
			continue;
		}
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

async function loadExpectedFailingTests(
	filePath: string
): Promise<Set<string>> {
	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as ExpectedFailingTestsFile | string[];
		if (Array.isArray(parsed)) {
			return new Set(parsed.filter((value) => typeof value === "string"));
		}
		if (parsed && Array.isArray(parsed.tests)) {
			return new Set(parsed.tests.filter((value) => typeof value === "string"));
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}
	return new Set();
}

async function writeExpectedFailingTests(
	filePath: string,
	tests: string[]
): Promise<void> {
	const payload: ExpectedFailingTestsFile = {
		tests: [...tests].sort(),
	};
	await writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
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
		collectCoverage?: boolean;
		installBindings?: boolean;
	}
): Promise<{
	page: Page;
	context: BrowserContext;
	waitForResult: (timeout: number, runwayToken?: string) => Promise<TestResult>;
	cancelWaitForResult: () => void;
	getOkCount: () => number;
	watchPage: (otherPage: Page) => () => void;
	cleanup: () => Promise<void>;
}> {
	const context: BrowserContext = await browser.newContext({
		ignoreHTTPSErrors: true,
	});
	const page = await context.newPage();
	if (options.collectCoverage) {
		await page.coverage.startJSCoverage({
			resetOnNavigation: false,
			reportAnonymousScripts: true,
		});
	}

	let resolveResult: (result: TestResult) => void;
	let timeoutId: NodeJS.Timeout | null = null;
	let resultPromise: Promise<TestResult>;
	let okCount = 0;
	let expectedRunwayToken: string | undefined;

	const resetPromise = () => {
		resultPromise = new Promise<TestResult>((resolve) => {
			resolveResult = resolve;
		});
		okCount = 0;
	};
	resetPromise();

	const onBindingCalled = (event: { name: string; payload: string }) => {
		const { name, payload } = event;
		if (!payload) return;
		let data: any;
		try {
			data = JSON.parse(payload);
		} catch {
			data = { message: payload, label: "default", value: payload };
		}
		if (
			expectedRunwayToken &&
			"__runwayToken" in data &&
			data.__runwayToken !== expectedRunwayToken
		) {
			return;
		}

		if (name === "__testPass") {
			if (timeoutId) clearTimeout(timeoutId);
			resolveResult({
				status: "pass",
				message: data.message,
				details: data.details,
			});
			resetPromise();
		} else if (name === "__testFail") {
			if (timeoutId) clearTimeout(timeoutId);
			resolveResult({
				status: "fail",
				message: data.message,
				details: data.details,
			});
			resetPromise();
		} else if (name === "__testConsistent") {
			if (options.onConsistent) {
				options.onConsistent(options.name, data.label, data.value);
			}
		} else if (name === "__testOk") {
			okCount++;
		}
	};

	const bindingHandle =
		options.installBindings === false
			? { dispose: () => {} }
			: await setupRunwayPageBindings(page, onBindingCalled);

	if (options.installBindings !== false) {
		page.on("pageerror", (error) => {
			if (timeoutId) clearTimeout(timeoutId);
			resolveResult({
				status: "fail",
				message: `Uncaught error: ${error.message}`,
				details: error.stack,
			});
			resetPromise();
		});
	}

	return {
		page,
		context,
		waitForResult: (timeout: number, runwayToken?: string) => {
			expectedRunwayToken = runwayToken;
			timeoutId = setTimeout(() => {
				resolveResult({
					status: "fail",
					message: `Test timed out after ${timeout}ms`,
				});
				resetPromise();
			}, timeout);
			return resultPromise;
		},
		cancelWaitForResult: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			expectedRunwayToken = undefined;
			resetPromise();
		},
		getOkCount: () => okCount,
		watchPage: (otherPage: Page) => {
			if (options.installBindings === false) {
				return () => {};
			}
			const onPageError = (error: Error) => {
				if (timeoutId) clearTimeout(timeoutId);
				resolveResult({
					status: "fail",
					message: `Uncaught error: ${error.message}`,
					details: error.stack,
				});
				resetPromise();
			};
			otherPage.on("pageerror", onPageError);
			return () => otherPage.off("pageerror", onPageError);
		},
		cleanup: async () => {
			if (timeoutId) clearTimeout(timeoutId);
			bindingHandle.dispose();
			await context.close().catch(() => {});
		},
	};
}

async function runTestOnHarness(
	page: Page,
	context: BrowserContext,
	waitForResult: (timeout: number, runwayToken?: string) => Promise<TestResult>,
	cancelWaitForResult: () => void,
	getOkCount: () => number,
	watchPage: (otherPage: Page) => () => void,
	test: Test,
	serverResult: Promise<TestResult> | null,
	timeout: number = 30000
): Promise<TestResult> {
	const warmProxiedUrl = async (url: string) => {
		const proxiedUrl = await page.evaluate((targetUrl) => {
			if (typeof (window as any).__runwayGetProxiedUrl === "function") {
				return (window as any).__runwayGetProxiedUrl(targetUrl);
			}
			return "";
		}, url);

		if (!proxiedUrl) return;

		await page.evaluate(
			async ({ url, timeout }) => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);
				try {
					const response = await fetch(url, {
						signal: controller.signal,
					});
					if (!response.ok) {
						throw new Error(`Warm fetch failed with ${response.status}`);
					}
					await response.body?.cancel().catch(() => {});
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}
					throw error;
				} finally {
					clearTimeout(timeoutId);
				}
			},
			{ url: proxiedUrl, timeout: Math.min(timeout, 5000) }
		);
	};

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

	const runwayToken = crypto.randomUUID();
	const testScheme = test.scheme ?? "http";
	const testUrl = test.topLevelScramjet
		? `${testScheme}://localhost:${test.port}${test.path ?? "/"}`
		: appendRunwayToken(
				`${testScheme}://localhost:${test.port}${test.path ?? "/"}`,
				runwayToken,
				test.name.startsWith("wpt-")
			);
	const harnessResultPromise = waitForResult(
		timeout,
		test.topLevelScramjet ? undefined : runwayToken
	);
	let result: TestResult;
	let topLevelPage: Page | null = null;
	let stopWatchingTopLevelPage: (() => void) | null = null;
	let topLevelNavigationPromise: Promise<void> | null = null;
	if (test.topLevelScramjet) {
		const proxiedUrl = await page.evaluate((url) => {
			if (typeof (window as any).__runwayGetProxiedUrl === "function") {
				return (window as any).__runwayGetProxiedUrl(url);
			}
			(window as any).__runwayNavigate(url);
			const iframe = document.getElementById(
				"testframe"
			) as HTMLIFrameElement | null;
			return iframe?.src || "";
		}, testUrl);
		await page.evaluate(
			async ({ url, timeout }) => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);
				try {
					const response = await fetch(url, {
						signal: controller.signal,
					});
					if (!response.ok) {
						throw new Error(`Warm fetch failed with ${response.status}`);
					}
					await response.body?.cancel().catch(() => {});
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}
					throw error;
				} finally {
					clearTimeout(timeoutId);
				}
			},
			{ url: proxiedUrl, timeout: Math.min(timeout, 5000) }
		);
		topLevelPage = await context.newPage();
		stopWatchingTopLevelPage = watchPage(topLevelPage);
		topLevelNavigationPromise = topLevelPage
			.goto(proxiedUrl, { waitUntil: "commit" })
			.then(() => {});
	} else {
		if (test.warmProxiedNavigation) {
			await warmProxiedUrl(testUrl);
		}
		await page.evaluate((url) => {
			// This function should be defined by the harness
			(window as any).__runwayNavigate(url);
		}, testUrl);
	}

	if (serverResult) {
		const raced = await Promise.race([
			harnessResultPromise.then((value) => ({
				source: "harness" as const,
				value,
			})),
			serverResult.then((value) => ({ source: "server" as const, value })),
			...(topLevelNavigationPromise
				? [
						topLevelNavigationPromise.then(
							() =>
								new Promise<never>(() => {
									// keep the race pending; completion is driven by pass/fail
								}),
							(error) => ({
								source: "navigation" as const,
								value: {
									status: "fail" as const,
									message:
										error instanceof Error ? error.message : String(error),
								},
							})
						),
					]
				: []),
		]);
		if (raced.source === "server") {
			cancelWaitForResult();
		}
		result = raced.value;
	} else {
		if (topLevelNavigationPromise) {
			const raced = await Promise.race([
				harnessResultPromise,
				topLevelNavigationPromise.then(
					() =>
						new Promise<never>(() => {
							// keep pending; pass/fail will resolve separately
						}),
					(error) => ({
						status: "fail" as const,
						message: error instanceof Error ? error.message : String(error),
					})
				),
			]);
			result = raced;
		} else {
			result = await harnessResultPromise;
		}
	}
	if (stopWatchingTopLevelPage) {
		stopWatchingTopLevelPage();
	}
	if (topLevelPage) {
		await topLevelPage.close().catch(() => {});
	}

	// Validate okCount if expectedOkCount is set
	if (result.status === "pass" && test.expectedOkCount !== undefined) {
		const actualOkCount = getOkCount();
		if (actualOkCount !== test.expectedOkCount) {
			return {
				status: "fail",
				message: `Expected ${test.expectedOkCount} ok() calls, but got ${actualOkCount}`,
				details: { expected: test.expectedOkCount, actual: actualOkCount },
			};
		}
	}

	return result;
}

function appendRunwayToken(url: string, token: string, useQuery: boolean) {
	const parsed = new URL(url);
	if (useQuery) {
		parsed.searchParams.set("runway_token", token);
		return parsed.toString();
	}
	const hashParams = new URLSearchParams(
		parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash
	);
	hashParams.set("runway_token", token);
	parsed.hash = hashParams.toString();
	return parsed.toString();
}

// Main runner
async function main() {
	console.log("🚀 Starting Runway test runner\n");

	const args = process.argv.slice(2);
	let testFilter: string | undefined;
	let parallelArg: number | undefined;
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--parallel" || arg === "--parallelism" || arg === "-p") {
			const next = args[i + 1];
			if (next) {
				parallelArg = Number(next);
				i += 1;
			}
			continue;
		}
		if (arg.startsWith("--parallel=")) {
			parallelArg = Number(arg.split("=")[1]);
			continue;
		}
		if (!testFilter) {
			testFilter = arg;
		}
	}

	const allTests = await discoverTests();

	// Filter tests if a pattern is provided
	const tests = testFilter
		? allTests.filter((t) => t.name.includes(testFilter!))
		: allTests;
	const parallelism = Math.max(
		1,
		Number(process.env.RUNWAY_PARALLEL ?? parallelArg ?? 1)
	);
	const fastMode = process.env.RUNWAY_FAST === "1";
	const omitWpt = process.env.OMIT_WPT === "1";
	const updateFailingTests = process.env.RUNWAY_UPDATE_FAILING === "1";
	const failingTestsPath = path.join(__dirname, "..", "failing_tests.json");
	const runBareTests = !fastMode;

	if (testFilter) {
		console.log(`� Filter: "${testFilter}"`);
	}
	console.log(
		`�📋 Found ${tests.length} test(s)${testFilter ? ` (${allTests.length} total)` : ""}\n`
	);
	if (parallelism > 1) {
		console.log(`🧵 Parallel workers: ${parallelism}\n`);
	}
	if (fastMode) {
		console.log(
			"⚡ Fast mode: reusing one scramjet harness instance per worker and skipping bare tests\n"
		);
	}
	if (updateFailingTests) {
		console.log("📝 Updating failing_tests.json from current run\n");
	}
	if (omitWpt) {
		console.log("🚫 WPT tests omitted via OMIT_WPT=1\n");
	}

	if (tests.length === 0) {
		console.log(
			`❌ No tests found${testFilter ? ` matching "${testFilter}"` : ""}`
		);
		process.exit(1);
	}

	const needsHarness = tests.some((test) => !test.directFn);
	const needsBareHarness =
		runBareTests && tests.some((test) => !test.directFn && !test.scramjetOnly);
	let scramjetUrl = "";
	let bareUrl = "";
	let browser: Browser | null = null;
	if (needsHarness) {
		// Start the harness servers
		const { startHarness, PORT: HARNESS_PORT } = await import(
			"./harness/scramjet/index.ts"
		);
		await startHarness();
		scramjetUrl = `http://localhost:${HARNESS_PORT}`;
		console.log(`📡 Scramjet harness running at ${scramjetUrl}`);
		if (needsBareHarness) {
			const { startBareHarness, BARE_PORT } = await import(
				"./harness/bare/index.ts"
			);
			await startBareHarness();
			bareUrl = `http://localhost:${BARE_PORT}`;
			console.log(`📡 Bare harness running at ${bareUrl}`);
		}
		console.log();

		browser = await chromium.launch({
			headless: process.env.HEADED !== "1",
		});
	} else {
		console.log("🧪 Direct tests only: skipping harness/browser startup\n");
	}

	const coverageEnabled = process.env.SCRAMJET_COVERAGE === "1";
	const coverageEntries: Array<{
		url: string;
		functions: any;
		source?: string;
	}> = [];
	const flushCoverage = async (page: Page | null | undefined) => {
		if (!coverageEnabled || !page || page.isClosed()) return;
		try {
			const entries = await page.coverage.stopJSCoverage();
			coverageEntries.push(...entries);
		} catch {
			// ignore
		}
	};

	const results: TestRunResult[] = [];

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
			await browser?.close();
			process.exit(1);
		}
	};

	const runTestsForWorker = async (workerId: number, workerTests: Test[]) => {
		let consistencyHandler: (
			source: HarnessKind,
			label: string,
			value: any
		) => Promise<void> = async () => {};
		const workerNeedsBare =
			runBareTests &&
			workerTests.some((test) => !test.directFn && !test.scramjetOnly);
		const createPages = async (installScramjetBindings: boolean) => {
			if (!browser) {
				throw new Error("Browser is unavailable for harness-based tests");
			}
			return {
				scramjet: await createTestPage(browser, {
					name: "scramjet",
					onConsistent: (source, label, value) =>
						consistencyHandler(source, label, value),
					collectCoverage: coverageEnabled,
					installBindings: installScramjetBindings,
				}),
				bare: workerNeedsBare
					? await createTestPage(browser, {
							name: "bare",
							onConsistent: (source, label, value) =>
								consistencyHandler(source, label, value),
						})
					: null,
			};
		};
		let scramjetBindingsInstalled = true;
		let testPages: Awaited<ReturnType<typeof createPages>> | null = null;
		let needsReload = true;

		for (const test of workerTests) {
			ghaGroup(`Test: ${test.name}`);

			const runBareForTest = runBareTests && !test.scramjetOnly;
			const consistencyTracker = createConsistencyTracker(runBareForTest);
			consistencyHandler = consistencyTracker.handle;
			if (!test.directFn && !fastMode && test.reloadHarness) {
				needsReload = true;
			}

			const start = Date.now();
			let result: TestResult | { status: "error"; message: string } | null =
				null;
			let started = false;
			try {
				if (test.directFn) {
					await test.directFn();
					result = { status: "pass" };
				} else {
					// Reload pages if needed (first run or after failure)
					const desiredScramjetBindings = fastMode
						? true
						: !test.topLevelScramjet;
					if (
						!testPages ||
						needsReload ||
						desiredScramjetBindings !== scramjetBindingsInstalled
					) {
						if (testPages) {
							if (!testPages.scramjet.page.isClosed()) {
								await flushCoverage(testPages.scramjet.page);
							}
							await Promise.all([
								testPages.scramjet.cleanup(),
								testPages.bare?.cleanup(),
							]);
						}
						scramjetBindingsInstalled = desiredScramjetBindings;
						testPages = await createPages(scramjetBindingsInstalled);
						await ensureHarnessReady(
							testPages.scramjet.page,
							scramjetUrl,
							"Scramjet"
						);
						if (testPages.bare) {
							await ensureHarnessReady(testPages.bare.page, bareUrl, "Bare");
						}
						needsReload = false;
					}

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
						testPages.scramjet.context,
						testPages.scramjet.waitForResult,
						testPages.scramjet.cancelWaitForResult,
						testPages.scramjet.getOkCount,
						testPages.scramjet.watchPage,
						test,
						serverResult,
						test.timeoutMs
					);
					const barePromise = runBareForTest
						? runTestOnHarness(
								testPages.bare!.page,
								testPages.bare!.context,
								testPages.bare!.waitForResult,
								testPages.bare!.cancelWaitForResult,
								testPages.bare!.getOkCount,
								testPages.bare!.watchPage,
								test,
								serverResult,
								test.timeoutMs
							)
						: null;

					const [scramjetResult, bareResult] = runBareForTest
						? await Promise.all([scramjetPromise, barePromise!])
						: [await scramjetPromise, null];

					const consistencyResult = await consistencyTracker.finalize(30000);

					let computedResult: TestResult;
					if (!runBareForTest) {
						computedResult = scramjetResult;
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
							failures.push(
								`bare: ${bareResult!.message || bareResult!.status}`
							);
						}
						computedResult = {
							status: "fail",
							message: failures.join(" | "),
							details: { scramjet: scramjetResult, bare: bareResult },
						};
					} else if (consistencyResult.status === "fail") {
						computedResult = {
							status: "fail",
							message: consistencyResult.message,
							details: consistencyResult.details,
						};
					} else {
						computedResult = { status: "pass" };
					}
					result = computedResult;
				}
			} catch (error) {
				result = {
					status: "error",
					message: error instanceof Error ? error.message : String(error),
				};
			} finally {
				if (!test.directFn && !test.playwrightFn && started) {
					try {
						await test.stop();
					} catch (error) {
						result = {
							status: "error",
							message: error instanceof Error ? error.message : String(error),
						};
					}
				}
			}

			const duration = Date.now() - start;
			const finalResult =
				result ?? ({ status: "error", message: "Unknown error" } as const);
			results.push({
				test,
				result: finalResult,
				duration,
			});

			if (finalResult.status === "pass") {
				console.log(`  ${test.name} ... ✅ passed (${duration}ms)`);
			} else if (finalResult.status === "fail") {
				console.log(
					[
						`  ${test.name} ... ❌ failed (${duration}ms)`,
						finalResult.message ? `     ${finalResult.message}` : null,
					]
						.filter(Boolean)
						.join("\n")
				);
				ghaError(
					`Test "${test.name}" failed: ${finalResult.message || "Unknown error"}`
				);
				if (!test.directFn) {
					needsReload = !fastMode; // Reload after failure unless fast mode is reusing harnesses
				}
			} else {
				console.log(
					[
						`  ${test.name} ... 💥 error (${duration}ms)`,
						finalResult.message ? `     ${finalResult.message}` : null,
					]
						.filter(Boolean)
						.join("\n")
				);
				ghaError(
					`Test "${test.name}" error: ${finalResult.message || "Unknown error"}`
				);
				if (!test.directFn) {
					needsReload = !fastMode; // Reload after error unless fast mode is reusing harnesses
				}
			}
			ghaEndGroup();
		}

		if (testPages) {
			await Promise.all([
				testPages.scramjet.cleanup(),
				testPages.bare?.cleanup(),
			]);
			await flushCoverage(testPages.scramjet.page);
		}
	};

	const workerCount = Math.min(parallelism, tests.length);
	const workerBuckets = Array.from({ length: workerCount }, () => [] as Test[]);
	for (let i = 0; i < tests.length; i += 1) {
		workerBuckets[i % workerCount].push(tests[i]);
	}
	await Promise.all(
		workerBuckets.map((bucket, index) => runTestsForWorker(index + 1, bucket))
	);
	await browser?.close();

	if (coverageEnabled && needsHarness) {
		const scramjetEntries = coverageEntries.filter((entry) =>
			entry.url?.includes("/scramjet/scramjet.js")
		);
		const scramjetRoot = path.resolve(__dirname, "..", "..", "..");
		const coreRoot = path.join(scramjetRoot, "packages", "core");
		const allowedRoots = [
			path.join(coreRoot, "src"),
			path.join(coreRoot, "rewriter", "src"),
			path.join(coreRoot, "packages"),
		];
		const coverageDir = path.join(__dirname, "..", "coverage");
		await mkdir(coverageDir, { recursive: true });
		const { createCoverageMap } = istanbulCoverage as typeof istanbulCoverage;
		const coverageMap = createCoverageMap({});

		if (scramjetEntries.length > 0) {
			const scramjetBundlePath = path.join(
				__dirname,
				"..",
				"node_modules",
				"@mercuryworkshop",
				"scramjet",
				"dist",
				"scramjet.js"
			);
			const mapPath = `${scramjetBundlePath}.map`;
			const bundleSource = await readFile(scramjetBundlePath, "utf-8");
			const rawMap = JSON.parse(await readFile(mapPath, "utf-8"));
			rawMap.sourceRoot = "";
			rawMap.sources = rawMap.sources.map((source: string) => {
				const normalized = source
					.replace(/^webpack:\/\/\$?[^/]*\//, "")
					.replace(/^\.?\//, "");
				if (normalized.startsWith("packages/")) {
					return path.join(scramjetRoot, normalized);
				}
				return normalized;
			});
			for (const entry of scramjetEntries) {
				const converter = v8toIstanbul(scramjetBundlePath, 0, {
					source: bundleSource,
					originalSource: bundleSource,
					sourceMap: { sourcemap: rawMap },
				});
				await converter.load();
				converter.applyCoverage(entry.functions as any);
				coverageMap.merge(converter.toIstanbul());
			}
		}

		const filteredCoverage: Record<string, any> = {};
		for (const [filePath, data] of Object.entries(coverageMap.toJSON())) {
			const normalized = filePath
				.replace(/^webpack:\/\/\$?[^/]*\//, "")
				.replace(/^webpack:\/\//, "")
				.replace(/^\.?\//, "");
			const normalizedPosix = normalized.replace(/\\/g, "/");
			if (normalizedPosix.includes("node_modules/")) continue;
			if (!normalizedPosix.includes("packages/core/")) continue;
			const resolved = normalizedPosix.startsWith("packages/")
				? path.join(scramjetRoot, normalizedPosix)
				: filePath;
			if (allowedRoots.some((root) => resolved.startsWith(root))) {
				filteredCoverage[resolved] = data;
			}
		}

		await writeFile(
			path.join(coverageDir, "scramjet-coverage.json"),
			JSON.stringify(filteredCoverage, null, 2),
			"utf-8"
		);
		const filteredCoverageMap = createCoverageMap(filteredCoverage);
		const summary = filteredCoverageMap.getCoverageSummary();
		const formatSummary = (item: typeof summary.lines) =>
			`${item.pct.toFixed(1)}% (${item.covered}/${item.total})`;
		console.log(
			`\n📊 Scramjet TS coverage written to coverage/scramjet-coverage.json (${Object.keys(filteredCoverage).length} files)`
		);
		console.log(
			`📈 Coverage summary: lines ${formatSummary(summary.lines)}, statements ${formatSummary(summary.statements)}, functions ${formatSummary(summary.functions)}, branches ${formatSummary(summary.branches)}`
		);

		const uncoveredFunctions: Array<{
			file: string;
			name: string;
			loc: {
				start: { line: number; column: number };
				end: { line: number; column: number };
			};
		}> = [];
		for (const [filePath, data] of Object.entries(filteredCoverage)) {
			const fnMap = (data as any).fnMap as Record<
				string,
				{
					name: string;
					loc: {
						start: { line: number; column: number };
						end: { line: number; column: number };
					};
				}
			>;
			const f = (data as any).f as Record<string, number>;
			for (const [key, count] of Object.entries(f)) {
				if (count === 0 && fnMap?.[key]) {
					const fn = fnMap[key];
					uncoveredFunctions.push({
						file: filePath,
						name: fn.name || "(anonymous)",
						loc: fn.loc,
					});
				}
			}
		}

		await writeFile(
			path.join(coverageDir, "scramjet-uncovered-functions.json"),
			JSON.stringify(uncoveredFunctions, null, 2),
			"utf-8"
		);
		console.log(
			`🧭 Uncovered functions written to coverage/scramjet-uncovered-functions.json (${uncoveredFunctions.length} entries)`
		);
	} else if (coverageEnabled) {
		console.log(
			"📊 Coverage requested, but no harness/browser tests ran. Skipping coverage output."
		);
	}

	// Summary
	console.log("\n" + "─".repeat(50));
	const passed = results.filter((r) => r.result.status === "pass").length;
	const failed = results.filter((r) => r.result.status === "fail").length;
	const errors = results.filter((r) => r.result.status === "error").length;

	console.log(
		`\n✅ ${passed} passed | ❌ ${failed} failed | 💥 ${errors} errors\n`
	);
	const selectedTestNames = new Set(tests.map((test) => test.name));
	const actualFailing = results
		.filter((r) => r.result.status !== "pass")
		.map((r) => r.test.name)
		.sort();

	if (updateFailingTests) {
		await writeExpectedFailingTests(failingTestsPath, actualFailing);
		console.log(
			`📝 Wrote ${actualFailing.length} failing test(s) to ${path.relative(process.cwd(), failingTestsPath)}`
		);
		process.exit(0);
	}

	const allExpectedFailing = await loadExpectedFailingTests(failingTestsPath);
	const expectedFailing = new Set(
		[...allExpectedFailing].filter((name) => selectedTestNames.has(name))
	);
	const unexpectedFailing = actualFailing.filter(
		(name) => !expectedFailing.has(name)
	);
	const noLongerFailing = [...expectedFailing]
		.filter((name) => !actualFailing.includes(name))
		.sort();

	console.log("Expected failing diff:");
	console.log(
		`  expected=${expectedFailing.size} actual=${actualFailing.length} unexpected=${unexpectedFailing.length} fixed=${noLongerFailing.length}`
	);
	if (unexpectedFailing.length > 0) {
		console.log("  unexpected failures:");
		for (const name of unexpectedFailing) {
			console.log(`    - ${name}`);
		}
	}
	if (noLongerFailing.length > 0) {
		console.log("  no longer failing:");
		for (const name of noLongerFailing) {
			console.log(`    - ${name}`);
		}
	}

	process.exit(unexpectedFailing.length > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});

import { chromium } from "playwright";
import {
	runwayCleartextHttpsHostList,
	runwayCleartextSiteForHarness,
	runwayTestTargetUrl,
	type Test,
} from "./testcommon.ts";
import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupRunwayPageBindings } from "./cdp-page.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function discoverTests(): Promise<Test[]> {
	const testFiles = glob("**/*.ts", {
		cwd: path.join(__dirname, "tests"),
	});

	const tests: Test[] = [];
	for await (const file of testFiles) {
		const fullPath = path.join(__dirname, "tests", file);
		const module = await import(fullPath);
		if (module.default) {
			if (Array.isArray(module.default)) {
				tests.push(...module.default);
			} else {
				tests.push(module.default);
			}
		}
	}
	return tests;
}

async function main() {
	const testFilter = process.argv[2];

	if (!testFilter) {
		console.log("Usage: pnpm inspect <test-name-pattern>");
		console.log("\nAvailable tests:");
		const tests = await discoverTests();
		for (const test of tests) {
			console.log(`  - ${test.name}`);
		}
		process.exit(1);
	}

	console.log(`🔍 Inspecting tests matching: ${testFilter}\n`);

	// Discover and filter tests
	const allTests = await discoverTests();
	const tests = allTests.filter((t) => t.name.includes(testFilter));

	if (tests.length === 0) {
		console.log(`❌ No tests found matching "${testFilter}"`);
		console.log("\nAvailable tests:");
		for (const test of allTests) {
			console.log(`  - ${test.name}`);
		}
		process.exit(1);
	}

	console.log(`📋 Found ${tests.length} matching test(s):`);
	for (const test of tests) {
		const suffix = test.directFn
			? " (direct)"
			: test.playwrightFn
				? " (playwright)"
				: "";
		console.log(`  - ${test.name}${suffix}`);
	}
	console.log();

	// Start all matching tests (only basicTests need servers)
	for (const test of tests) {
		if (!test.playwrightFn && !test.directFn) {
			await test.start({
				pass: async (message?: string, details?: any) => {
					console.log(`\n✅ Test passed${message ? `: ${message}` : ""}`);
					if (details) console.log("   Details:", details);
				},
				fail: async (message?: string, details?: any) => {
					console.log(`\n❌ Test failed${message ? `: ${message}` : ""}`);
					if (details) console.log("   Details:", details);
				},
			});
			console.log(
				`🌐 Test "${test.name}" running at ${runwayTestTargetUrl(test)}`
			);
		}
	}

	const directOnlyTests = tests.filter((test) => test.directFn);
	const browserTests = tests.filter((test) => !test.directFn);
	if (browserTests.length === 0 && directOnlyTests.length > 0) {
		for (const test of directOnlyTests) {
			process.stdout.write(`  ${test.name} ... `);
			try {
				await test.directFn!();
				console.log("✅ passed");
			} catch (error) {
				console.log(
					`❌ failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
		process.exit(0);
	}

	// Start the harness server
	const { startHarness, PORT: HARNESS_PORT } = await import(
		"./harness/scramjet/index.ts"
	);
	await startHarness();
	const harnessUrl = `http://localhost:${HARNESS_PORT}`;
	console.log(`\n📡 Harness running at ${harnessUrl}`);

	// Launch browser
	const browser = await chromium.launch({
		headless: false,
		devtools: true,
	});

	const page = await browser.newPage();
	await setupRunwayPageBindings(page, (event) => {
		const { name, payload } = event;
		let data: any;
		try {
			data = JSON.parse(payload);
		} catch {
			data = { message: payload, label: "default", value: payload };
		}

		if (name === "__testPass") {
			console.log(`\n✅ Test passed${data.message ? `: ${data.message}` : ""}`);
			if (data.details) console.log("   Details:", data.details);
		} else if (name === "__testFail") {
			console.log(`\n❌ Test failed${data.message ? `: ${data.message}` : ""}`);
			if (data.details) console.log("   Details:", data.details);
		} else if (name === "__testConsistent") {
			const label = data.label ?? "default";
			console.log(`\n🔁 assertConsistent[${label}]`, data.value);
		}
	});

	page.on("pageerror", (error) => {
		console.log(`\n💥 Page error: ${error.message}`);
	});

	page.on("console", (msg) => {
		const type = msg.type();
		const prefix = type === "error" ? "❌" : type === "warning" ? "⚠️" : "📝";
		console.log(`${prefix} [console.${type}] ${msg.text()}`);
	});

	// Navigate to harness
	await page.goto(harnessUrl);

	// Wait for harness to be ready
	try {
		await page.waitForFunction(
			() => typeof (window as any).__runwayNavigate === "function",
			{ timeout: 30000 }
		);
		console.log("✅ Harness ready\n");
	} catch (e) {
		console.error("💥 Harness failed to initialize");
		await browser.close();
		process.exit(1);
	}

	// Navigate to first test
	const firstTest = browserTests[0];

	if (firstTest.playwrightFn) {
		console.log(
			`🎭 Playwright test "${firstTest.name}" - use navigate() in your test`
		);
		console.log("   Running playwright test function...\n");

		const frame = page.frameLocator("#testframe");
		const navigate = async (url: string) => {
			console.log(`🚀 Navigating to: ${url}`);
			await page.evaluate((u) => {
				(window as any).__runwayNavigate(u);
			}, url);
		};

		try {
			await firstTest.playwrightFn({ page, frame, navigate });
			console.log("\n✅ Playwright test completed successfully");
		} catch (error) {
			console.log(
				`\n❌ Playwright test failed: ${error instanceof Error ? error.message : error}`
			);
		}
	} else {
		const testUrl = runwayTestTargetUrl(firstTest);
		console.log(`🚀 Navigating to test: ${testUrl}`);

		await page.evaluate(
			(payload: {
				hosts: string[];
				site: { roots: string[]; httpPort: number } | null;
			}) => {
				(window as any).__runwayCleartextHttpsHosts = payload.hosts;
				(window as any).__runwayCleartextSite = payload.site;
			},
			{
				hosts: runwayCleartextHttpsHostList(firstTest),
				site: runwayCleartextSiteForHarness(firstTest),
			}
		);

		if (firstTest.topLevelScramjet) {
			const proxiedUrl = await page.evaluate((url) => {
				if (typeof (window as any).__runwayGetProxiedUrl === "function") {
					return (window as any).__runwayGetProxiedUrl(url);
				}
				throw new Error("__runwayGetProxiedUrl is unavailable");
			}, testUrl);

			await page.evaluate(async (url) => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000);
				try {
					const response = await fetch(url, { signal: controller.signal });
					await response.body?.cancel().catch(() => {});
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}
					throw error;
				} finally {
					clearTimeout(timeoutId);
				}
			}, proxiedUrl);

			console.log(`🌐 Opening top-level Scramjet page: ${proxiedUrl}`);
			await page.goto(proxiedUrl, { waitUntil: "commit" });
		} else {
			await page.evaluate((url) => {
				(window as any).__runwayNavigate(url);
			}, testUrl);
		}
	}

	console.log("\n" + "─".repeat(50));
	console.log("🔍 Browser open for manual inspection");
	console.log("   Press Ctrl+C to exit\n");

	if (browserTests.length > 1) {
		console.log("Other test URLs (navigate manually via harness):");
		for (const test of browserTests.slice(1)) {
			console.log(`  - ${runwayTestTargetUrl(test)}`);
		}
		console.log();
	}

	// Keep the process running
	await new Promise(() => {});
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});

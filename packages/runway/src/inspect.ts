import { chromium } from "playwright";
import type { Test } from "./testcommon.ts";
import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
		console.log(`  - ${test.name}${test.playwrightFn ? " (playwright)" : ""}`);
	}
	console.log();

	// Start all matching tests (only basicTests need servers)
	for (const test of tests) {
		if (!test.playwrightFn) {
			await test.start();
			console.log(
				`🌐 Test "${test.name}" running at http://localhost:${test.port}/`
			);
		}
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

	// Expose test reporting functions
	await page.exposeFunction("__testPass", (message?: string, details?: any) => {
		console.log(`\n✅ Test passed${message ? `: ${message}` : ""}`);
		if (details) console.log("   Details:", details);
	});

	await page.exposeFunction("__testFail", (message?: string, details?: any) => {
		console.log(`\n❌ Test failed${message ? `: ${message}` : ""}`);
		if (details) console.log("   Details:", details);
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
	const firstTest = tests[0];

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
		const testUrl = `http://localhost:${firstTest.port}/`;
		console.log(`🚀 Navigating to test: ${testUrl}`);

		await page.evaluate((url) => {
			(window as any).__runwayNavigate(url);
		}, testUrl);
	}

	console.log("\n" + "─".repeat(50));
	console.log("🔍 Browser open for manual inspection");
	console.log("   Press Ctrl+C to exit\n");

	if (tests.length > 1) {
		console.log("Other test URLs (navigate manually via harness):");
		for (const test of tests.slice(1)) {
			console.log(`  - http://localhost:${test.port}/`);
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

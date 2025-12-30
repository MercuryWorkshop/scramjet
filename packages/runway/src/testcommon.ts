import http from "http";
import type { FrameLocator, Page } from "playwright";

export type TestContext = {
	/** The Playwright page object for the harness */
	page: Page;
	/** FrameLocator for the test iframe inside the harness */
	frame: FrameLocator;
	/** Navigate the iframe to a URL through the scramjet proxy */
	navigate: (url: string) => Promise<void>;
};

export type Test = {
	name: string;
	port: number;
	start: () => Promise<void>;
	stop: () => Promise<void>;
	/** If defined, this is a playwright test that controls the browser directly */
	playwrightFn?: (ctx: TestContext) => Promise<void>;
};

// Common JS that gets injected into every test page
// The harness injects __testPass and __testFail directly into the iframe's window
const COMMON_JS = `
// Test reporting API - calls functions injected by the harness
// The harness defines __testPass and __testFail on the iframe's window

// Wait for the harness to inject the test functions (polls every 10ms)
function waitForTestFunctions(timeout = 5000) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		function check() {
			if (typeof __testPass === 'function' && typeof __testFail === 'function') {
				resolve();
			} else if (Date.now() - start > timeout) {
				reject(new Error('Timed out waiting for test functions to be injected'));
			} else {
				setTimeout(check, 10);
			}
		}
		check();
	});
}

function pass(message, details) {
	__testPass(message, details);
}

function fail(message, details) {
	__testFail(message, details);
}
if (typeof __eval != "function") {
	window.__eval = eval;
	window.__testPass = function() {
	console.log("TEST PASSED", ...arguments);
	};
	window.__testFail = function() {
	console.error("TEST FAILED", ...arguments);
	}
}
const realtop = __eval("top");
const reallocation = __eval("location");
const realparent = __eval("location");
function checkglobal(global) {
	assert(global !== realtop, "top was leaked");
	assert(global !== reallocation, "location was leaked");
	assert(global !== realparent, "parent was leaked");
	assert(global !== __eval, "eval was leaked");
}

function assert(condition, message) {
	if (!condition) {
		fail(message || 'Assertion failed');
		throw new Error(message || 'Assertion failed');
	}
}

function assertEqual(actual, expected, message) {
	if (actual !== expected) {
		const msg = message || \`Expected \${JSON.stringify(expected)}, got \${JSON.stringify(actual)}\`;
		fail(msg, { actual, expected });
		throw new Error(msg);
	}
}

function assertDeepEqual(actual, expected, message) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		const msg = message || \`Deep equality failed\`;
		fail(msg, { actual, expected });
		throw new Error(msg);
	}
}

async function runTest(testFn) {
	try {
		await waitForTestFunctions();
		await testFn();
		pass();
	} catch (err) {
		fail(err.message, { stack: err.stack });
	}
}
`;

let nextPort = 9000;

export function basicTest(props: {
	name: string;
	js: string;
	autoPass?: boolean;
}): Test {
	const port = nextPort++;
	let server: http.Server;

	return {
		name: props.name,
		port,
		async start() {
			return new Promise((resolve) => {
				server = http.createServer((req, res) => {
					if (req.url === "/") {
						res.writeHead(200, { "Content-Type": "text/html" });
						res.end(`
							<!DOCTYPE html>
							<html>
								<head>
									<script src="/common.js"></script>
								</head>
								<body>
									<h1>Test - ${props.name}</h1>
									<script src="/script.js"></script>
								</body>
							</html>
						`);
					} else if (req.url === "/common.js") {
						res.writeHead(200, { "Content-Type": "application/javascript" });
						res.end(COMMON_JS);
					} else if (req.url === "/script.js") {
						res.writeHead(200, { "Content-Type": "application/javascript" });
						res.end(
							`runTest(async () => {\n${props.js}\n}, ${props.autoPass || false});`
						);
					} else {
						res.writeHead(404);
						res.end("Not found");
					}
				});
				server.listen(port, () => resolve());
			});
		},
		async stop() {
			return new Promise((resolve) => {
				server.close(() => resolve());
			});
		},
	};
}

/**
 * Create a test that uses Playwright to control the browser directly.
 * The test function receives a TestContext with:
 * - page: The Playwright Page object
 * - frame: A FrameLocator for the test iframe
 * - navigate(url): Navigate the iframe to a URL through scramjet
 *
 * Example:
 * ```ts
 * playwrightTest({
 *   name: "youtube-loads",
 *   fn: async ({ frame, navigate }) => {
 *     await navigate("https://www.youtube.com/");
 *     const logo = await frame.locator("#logo-icon").first();
 *     await logo.waitFor({ state: "visible" });
 *   }
 * })
 * ```
 */
export function playwrightTest(props: {
	name: string;
	fn: (ctx: TestContext) => Promise<void>;
}): Test {
	return {
		name: props.name,
		port: 0, // Not used for playwright tests
		async start() {
			// No server needed
		},
		async stop() {
			// Nothing to stop
		},
		playwrightFn: props.fn,
	};
}

// same as basicTest but gives us a handle to the server
export function serverTest(props: {
	name: string;
	start: (server: http.Server, port: number) => Promise<void>;
	autoPass?: boolean;
	js?: string;
}) {
	const port = nextPort++;
	let server: http.Server;

	return {
		name: props.name,
		port,
		async start() {
			server = http.createServer(
				{
					// Only accept websocket upgrades, reject others (like h2c) so they fall back to normal HTTP
					shouldUpgradeCallback: (req) =>
						req.headers.upgrade?.toLowerCase() === "websocket",
				},
				(req, res) => {
					if (props.js) {
						if (req.url === "/") {
							res.writeHead(200, { "Content-Type": "text/html" });
							res.end(`
							<!DOCTYPE html>
							<html>
								<head>
									<script src="/common.js"></script>
								</head>
								<body>
									<h1>Test - ${props.name}</h1>
									<script src="/script.js"></script>
								</body>
							</html>
						`);
						} else if (req.url === "/common.js") {
							res.writeHead(200, { "Content-Type": "application/javascript" });
							res.end(COMMON_JS);
						} else if (req.url === "/script.js") {
							res.writeHead(200, { "Content-Type": "application/javascript" });
							res.end(
								`runTest(async () => {\n${props.js || ""}\n}, ${props.autoPass || false});`
							);
						}
					}
				}
			);
			await props.start(server, port);
			return new Promise<void>((resolve) => {
				server.listen(port, () => resolve());
			});
		},
		async stop() {
			return new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
	};
}

import http from "http";
import type { AddressInfo, Socket } from "node:net";
import type { FrameLocator, Page } from "playwright";

export type TestContext = {
	/** The Playwright page object for the harness */
	page: Page;
	/** FrameLocator for the test iframe inside the harness */
	frame: FrameLocator;
	/** Navigate the iframe to a URL through the scramjet proxy */
	navigate: (url: string) => Promise<void>;
};

export type DirectTestContext = {
	assert: (condition: unknown, message?: string) => void;
	assertEqual: (actual: unknown, expected: unknown, message?: string) => void;
};

export type Test = {
	name: string;
	port: number;
	scheme?: "http" | "https";
	path?: string;
	timeoutMs?: number;
	reloadHarness?: boolean;
	topLevelScramjet?: boolean;
	warmProxiedNavigation?: boolean;
	start: (ctx: {
		pass: (message?: string, details?: any) => Promise<void>;
		fail: (message?: string, details?: any) => Promise<void>;
	}) => Promise<void>;
	stop: () => Promise<void>;
	/** If true, only run this test in the scramjet harness */
	scramjetOnly?: boolean;
	/** If defined, this is a playwright test that controls the browser directly */
	playwrightFn?: (ctx: TestContext) => Promise<void>;
	/** If defined, this test runs directly in-process and does not use the harness/browser */
	directFn?: () => Promise<void>;
	/** Expected number of ok() calls. Test will fail if actual count doesn't match */
	expectedOkCount?: number;
};

let nextPort = 10000 + Math.floor(Math.random() * 40000);

export function basicTest(props: {
	name: string;
	js: string;
	autoPass?: boolean;
	scramjetOnly?: boolean;
	expectedOkCount?: number;
}): Test {
	let port = 0;
	let server: http.Server;
	const scramjetOnly = props.scramjetOnly ?? /checkglobal\s*\(/i.test(props.js);
	const test: Test = {
		name: props.name,
		port,
		scramjetOnly,
		expectedOkCount: props.expectedOkCount,
		async start() {
			return new Promise((resolve) => {
				server = http.createServer((req, res) => {
					if (req.url === "/") {
						res.writeHead(200, { "Content-Type": "text/html" });
						res.end(`
							<!DOCTYPE html>
							<html>
								<head>
								</head>
								<body>
									<h1>Test - ${props.name}</h1>
									<script src="/script.js"></script>
								</body>
							</html>
						`);
					} else if (req.url === "/script.js") {
						res.writeHead(200, { "Content-Type": "application/javascript" });
						res.end(
							`runTest(async () => {\n${props.js}\n}, ${props.autoPass ?? true});`
						);
					} else {
						res.writeHead(404);
						res.end("Not found");
					}
				});
				server.listen(0, () => {
					port = (server.address() as AddressInfo).port;
					test.port = port;
					resolve();
				});
			});
		},
		async stop() {
			return Promise.race([
				new Promise<void>((resolve) => {
					// Close all active connections first to prevent hanging
					if (server.closeAllConnections) {
						server.closeAllConnections();
					}
					server.close(() => resolve());
				}),
				new Promise<void>((_, reject) => {
					setTimeout(
						() => reject(new Error("Server stop timed out after 5 seconds")),
						5000
					);
				}),
			]);
		},
	};
	return test;
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
		scramjetOnly: true,
	};
}

export function directTest(props: {
	name: string;
	fn: (ctx: DirectTestContext) => Promise<void> | void;
	timeoutMs?: number;
}): Test {
	return {
		name: props.name,
		port: 0,
		timeoutMs: props.timeoutMs,
		async start() {
			// No server needed
		},
		async stop() {
			// Nothing to stop
		},
		scramjetOnly: true,
		directFn: async () => {
			const assert = (condition: unknown, message = "Assertion failed") => {
				if (!condition) throw new Error(message);
			};
			const assertEqual = (
				actual: unknown,
				expected: unknown,
				message = "Values are not equal"
			) => {
				if (!Object.is(actual, expected)) {
					throw new Error(
						`${message}\nExpected: ${String(expected)}\nActual: ${String(actual)}`
					);
				}
			};

			await props.fn({ assert, assertEqual });
		},
	};
}

// same as basicTest but gives us a handle to the server
export function serverTest(props: {
	name: string;
	start: (
		server: http.Server,
		port: number,
		ctx: {
			pass: (message?: string, details?: any) => Promise<void>;
			fail: (message?: string, details?: any) => Promise<void>;
		}
	) => Promise<void>;
	autoPass?: boolean;
	js?: string;
	scramjetOnly?: boolean;
	expectedOkCount?: number;
}) {
	let port = 0;
	let server: http.Server;
	const activeSockets = new Set<Socket>();
	const scramjetOnly =
		props.scramjetOnly ??
		(props.js ? /checkglobal\s*\(/i.test(props.js) : false);
	const test: Test = {
		name: props.name,
		port,
		scramjetOnly,
		expectedOkCount: props.expectedOkCount,
		async start({
			pass,
			fail,
		}: {
			pass: (message?: string, details?: any) => Promise<void>;
			fail: (message?: string, details?: any) => Promise<void>;
		}) {
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
								</head>
								<body>
									<h1>Test - ${props.name}</h1>
									<script src="/script.js"></script>
								</body>
							</html>
						`);
						} else if (req.url === "/script.js") {
							res.writeHead(200, { "Content-Type": "application/javascript" });
							res.end(
								`runTest(async () => {\n${props.js || ""}\n}, ${props.autoPass || false});`
							);
						}
					}
				}
			);
			server.on("connection", (socket) => {
				activeSockets.add(socket);
				socket.on("close", () => {
					activeSockets.delete(socket);
				});
			});
			return new Promise<void>((resolve) => {
				server.listen(0, async () => {
					port = (server.address() as AddressInfo).port;
					test.port = port;
					await props.start(server, port, { pass, fail });
					resolve();
				});
			});
		},
		async stop() {
			// TODO: timeout should be in the parent
			return Promise.race([
				new Promise<void>((resolve) => {
					// Close all active connections first to prevent hanging
					if (server.closeAllConnections) {
						server.closeAllConnections();
					}
					for (const socket of activeSockets) {
						socket.destroy();
					}
					activeSockets.clear();
					server.close(() => resolve());
				}),
				new Promise<void>((_, reject) => {
					setTimeout(
						() => reject(new Error("Server stop timed out after 5 seconds")),
						5000
					);
				}),
			]);
		},
	};
	return test;
}

type Frame = {
	js: (ctx: { url: string }) => string;
	id?: string;
	originid?: string;
	subframes?: Frame[];
};

export function multiFrameTest(props: {
	name: string;
	root: Frame;
	expectedOkCount?: number;
}): Test {
	type Server = {
		server: http.Server;
		port: number;
		js: Record<string, string>;
		subframes: Record<string, string[]>;
	};

	const servers: Record<string, Server> = {};
	const serversOpenPromise: Promise<void>[] = [];

	const createServer = (originid: string) => {
		const js: Record<string, string> = {};
		const subframes: Record<string, string[]> = {};
		const port = nextPort++;

		const server = http.createServer((req, res) => {
			if (req.url === "/") {
				res.writeHead(302, {
					Location: `http://localhost:${port}/${props.root.id}`,
				});
				res.end();
			} else {
				if (req.url!.endsWith(".js")) {
					const id = req.url!.split("/").pop()!.split(".")[0];
					if (!js[id]) {
						res.writeHead(404);
						res.end("Not found");
						return;
					}
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(js[id]);
				} else {
					const id = req.url!.split("/").pop()!;

					const subframesHtml: string[] = [];
					for (const subframe of subframes[id]) {
						const server = Object.values(servers).find(
							(server) => server.js[subframe]
						)!;
						subframesHtml.push(`
							<iframe src="http://localhost:${server.port}/${subframe}"></iframe>
						`);
					}
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`
						<!DOCTYPE html>
						<html>
							<head>
							</head>
							<body>
								<h1>Frame ${originid}/${id}</h1>
								${subframesHtml.join("<br>")}
								<script src="/${id}.js"></script>
							</body>
						</html>
					`);
				}
			}
		});

		serversOpenPromise.push(
			new Promise((resolve) => {
				server.listen(port, () => resolve());
			})
		);

		return {
			server,
			subframes,
			port,
			js,
		};
	};

	const walk = (frame: Frame) => {
		frame.id ??= "main";
		frame.originid ??= "main";
		frame.subframes ??= [];
		let server: Server;
		if (servers[frame.originid]) {
			server = servers[frame.originid];
		} else {
			server = createServer(frame.originid);
			servers[frame.originid] = server;
		}

		const url = `http://localhost:${server.port}/${frame.id}`;
		server.js[frame.id] = frame.js({
			url,
		});
		server.subframes[frame.id] = frame.subframes!.map(
			(subframe) => subframe.id!
		);

		for (const subframe of frame.subframes) {
			walk(subframe);
		}
	};
	walk(props.root);

	return {
		name: props.name,
		port: servers[props.root.originid!]!.port,
		expectedOkCount: props.expectedOkCount,
		async start() {
			await Promise.all(serversOpenPromise);
		},
		async stop() {
			const promises: Promise<void>[] = [];
			for (const server of Object.values(servers)) {
				promises.push(
					new Promise((resolve) => {
						server.server.closeAllConnections();
						server.server.close(() => resolve());
					})
				);
			}
			await Promise.all(promises);
		},
	};
}

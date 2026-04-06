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

	let servers: Record<string, Server> = {};
	let serversOpenPromise: Promise<void>[] = [];

	const createServer = (originid: string) => {
		const js: Record<string, string> = {};
		let subframes: Record<string, string[]> = {};
		let port = nextPort++;

		let server = http.createServer((req, res) => {
			if (req.url === "/") {
				res.writeHead(302, {
					Location: `http://localhost:${port}/${props.root.id}`,
				});
				res.end();
			} else {
				if (req.url!.endsWith(".js")) {
					let id = req.url!.split("/").pop()!.split(".")[0];
					if (!js[id]) {
						res.writeHead(404);
						res.end("Not found");
						return;
					}
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(js[id]);
				} else {
					let id = req.url!.split("/").pop()!;

					let subframesHtml: string[] = [];
					for (const subframe of subframes[id]) {
						let server = Object.values(servers).find(
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

		let url = `http://localhost:${server.port}/${frame.id}`;
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
			let promises: Promise<void>[] = [];
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

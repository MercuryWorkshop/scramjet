import http from "http";

export type Test = {
	name: string;
	port: number;
	start: () => Promise<void>;
	stop: () => Promise<void>;
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

export function basicTest(props: { name: string; js: string }): Test {
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
						res.end(props.js);
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

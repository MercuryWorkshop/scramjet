import http from "http";
import type { AddressInfo } from "node:net";
import { basicTest, type Test } from "../testcommon.ts";

function html(body: string) {
	return `<!doctype html><html><body>${body}</body></html>`;
}

function listen(server: http.Server): Promise<number> {
	return new Promise((resolve) => {
		server.listen(0, () => {
			resolve((server.address() as AddressInfo).port);
		});
	});
}

function close(server?: http.Server): Promise<void> {
	if (!server) return Promise.resolve();

	return new Promise((resolve) => {
		server.closeAllConnections?.();
		server.close(() => resolve());
	});
}

function requestRefererTest(props: {
	name: string;
	expectedReferer: (sourcePort: number) => string;
	crossOrigin?: boolean;
}): Test {
	let sourceServer: http.Server | undefined;
	let targetServer: http.Server | undefined;
	let sourcePort = 0;
	let targetPort = 0;
	let settled = false;

	const pagePath = "/source/page.html?token=runway";
	const pagePathname = "/source/page.html";

	const test: Test = {
		name: props.name,
		port: 0,
		async start({ pass, fail }) {
			settled = false;

			const finish = async (
				status: "pass" | "fail",
				message?: string,
				details?: any
			) => {
				if (settled) return;
				settled = true;
				if (status === "pass") {
					await pass(message, details);
				} else {
					await fail(message, details);
				}
			};

			const handleTargetRequest = (
				req: http.IncomingMessage,
				res: http.ServerResponse
			) => {
				if (req.url !== "/inspect") {
					res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
					res.end("Not found");
					return;
				}

				const actual = req.headers.referer ?? null;
				const expected = props.expectedReferer(sourcePort);

				res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
				res.end();

				if (actual === expected) {
					void finish("pass", `received expected referer: ${expected}`);
				} else {
					void finish("fail", "unexpected referer header", {
						actual,
						expected,
					});
				}
			};

			if (props.crossOrigin) {
				targetServer = http.createServer(handleTargetRequest);
				targetPort = await listen(targetServer);
			}

			sourceServer = http.createServer((req, res) => {
				const url = new URL(req.url ?? "/", "http://localhost");

				if (url.pathname === "/") {
					res.writeHead(302, { Location: pagePath });
					res.end();
					return;
				}

				if (
					url.pathname === pagePathname &&
					url.searchParams.get("token") === "runway"
				) {
					const inspectUrl = props.crossOrigin
						? `http://localhost:${targetPort}/inspect`
						: `http://localhost:${sourcePort}/inspect`;

					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						html(
							`<script>
								runTest(async () => {
									await fetch(${JSON.stringify(inspectUrl)});
								}, false);
							</script>`
						)
					);
					return;
				}

				if (!props.crossOrigin) {
					handleTargetRequest(req, res);
					return;
				}

				res.writeHead(404);
				res.end("Not found");
			});

			sourcePort = await listen(sourceServer);
			if (!props.crossOrigin) {
				targetPort = sourcePort;
			}
			test.port = sourcePort;
		},
		async stop() {
			await Promise.all([close(sourceServer), close(targetServer)]);
		},
	};

	return test;
}

function iframeRefererTest(props: {
	name: string;
	expectedReferer: (sourcePort: number) => string;
	crossOrigin?: boolean;
	mode: "document" | "request";
}): Test {
	let sourceServer: http.Server | undefined;
	let targetServer: http.Server | undefined;
	let sourcePort = 0;
	let targetPort = 0;

	const parentPath = "/source/parent.html?token=runway-iframe";
	const parentPathname = "/source/parent.html";
	const childPathname = "/child/frame.html";

	const childHtml = (actualRefererHeader: string | null) => {
		const expected = props.expectedReferer(sourcePort);
		const assertions =
			props.mode === "request"
				? `
					assertEqual(
						${JSON.stringify(actualRefererHeader)},
						${JSON.stringify(expected)},
						"iframe navigation should send the expected Referer header"
					);
				`
				: `
					assertEqual(
						document.referrer,
						${JSON.stringify(expected)},
						"iframe document.referrer should match the expected parent referrer"
					);
					assert(
						document.referrer !== location.href,
						"iframe document.referrer should not equal the iframe location"
					);
				`;
		return html(
			`<script>
				runTest(async () => {
					${assertions}
				}, true);
			</script>`
		);
	};

	const test: Test = {
		name: props.name,
		port: 0,
		async start() {
			const handleChildRequest = (
				req: http.IncomingMessage,
				res: http.ServerResponse
			) => {
				if (
					new URL(req.url ?? "/", "http://localhost").pathname !== childPathname
				) {
					res.writeHead(404);
					res.end("Not found");
					return;
				}

				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(childHtml(req.headers.referer ?? null));
			};

			if (props.crossOrigin) {
				targetServer = http.createServer(handleChildRequest);
				targetPort = await listen(targetServer);
			}

			sourceServer = http.createServer((req, res) => {
				const url = new URL(req.url ?? "/", "http://localhost");

				if (url.pathname === "/") {
					res.writeHead(302, { Location: parentPath });
					res.end();
					return;
				}

				if (
					url.pathname === parentPathname &&
					url.searchParams.get("token") === "runway-iframe"
				) {
					const childUrl = props.crossOrigin
						? `http://localhost:${targetPort}${childPathname}`
						: `http://localhost:${sourcePort}${childPathname}`;
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(html(`<iframe src="${childUrl}" id="child"></iframe>`));
					return;
				}

				if (!props.crossOrigin) {
					handleChildRequest(req, res);
					return;
				}

				res.writeHead(404);
				res.end("Not found");
			});

			sourcePort = await listen(sourceServer);
			if (!props.crossOrigin) {
				targetPort = sourcePort;
			}
			test.port = sourcePort;
		},
		async stop() {
			await Promise.all([close(sourceServer), close(targetServer)]);
		},
	};

	return test;
}

export default [
	basicTest({
		name: "referer-document-referrer-is-not-current-location",
		js: `
			assert(document.referrer.length > 0, "document.referrer should be populated inside the test iframe");
			assert(
				document.referrer !== location.href,
				"document.referrer should describe the previous document, not the current one"
			);
		`,
	}),
	requestRefererTest({
		name: "referer-fetch-same-origin-sends-full-url",
		expectedReferer: (sourcePort) =>
			`http://localhost:${sourcePort}/source/page.html?token=runway`,
	}),
	requestRefererTest({
		name: "referer-fetch-cross-origin-sends-origin-only",
		crossOrigin: true,
		expectedReferer: (sourcePort) => `http://localhost:${sourcePort}/`,
	}),
	iframeRefererTest({
		name: "referer-iframe-document-same-origin-uses-full-url",
		mode: "document",
		expectedReferer: (sourcePort) =>
			`http://localhost:${sourcePort}/source/parent.html?token=runway-iframe`,
	}),
	iframeRefererTest({
		name: "referer-iframe-document-cross-origin-uses-origin-only",
		mode: "document",
		crossOrigin: true,
		expectedReferer: (sourcePort) => `http://localhost:${sourcePort}/`,
	}),
	iframeRefererTest({
		name: "referer-iframe-request-same-origin-sends-full-url",
		mode: "request",
		expectedReferer: (sourcePort) =>
			`http://localhost:${sourcePort}/source/parent.html?token=runway-iframe`,
	}),
	iframeRefererTest({
		name: "referer-iframe-request-cross-origin-sends-origin-only",
		mode: "request",
		crossOrigin: true,
		expectedReferer: (sourcePort) => `http://localhost:${sourcePort}/`,
	}),
];

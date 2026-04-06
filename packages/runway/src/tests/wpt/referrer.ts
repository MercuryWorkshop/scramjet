import http from "http";
import https from "https";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Test } from "../../testcommon.ts";
import {
	REFERRER_GENERATED_ROOTS,
	REFERRER_INHERITANCE_PAGES,
} from "./selection.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../../../..");
const vendorRoot = path.join(__dirname, "vendored");
const testServerCertRoot = path.join(
	repoRoot,
	"external/playwright/tests/config/testserver"
);

const WPT_TESTHARNESS_JS = `
(() => {
	const failures = [];
	const pendingNames = new Set();
	let pending = 0;
	let loadFired = false;
	let finished = false;
	let stuckTimer = null;
	const runwayReport = new URL(location.href).searchParams.get("runway_report");
	const reportOk = typeof ok === "function" ? ok : () => {};

	function reportResult(status, message, details) {
		if (!runwayReport) {
			if (status === "pass" && typeof pass === "function") pass(message, details);
			if (status === "fail" && typeof fail === "function") fail(message, details);
			return;
		}
		fetch(runwayReport, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status, message, details }),
			keepalive: true,
			mode: "cors",
		}).catch(() => {});
	}

	function formatError(error) {
		if (!error) return "Unknown error";
		if (error instanceof Error) return error.stack || error.message;
		return String(error);
	}

	function maybeFinish() {
		if (finished || !loadFired || pending !== 0) return;
		finished = true;
		if (stuckTimer) {
			clearTimeout(stuckTimer);
			stuckTimer = null;
		}
		if (failures.length) {
			const message = failures
				.map((entry) => entry.name + ": " + entry.error)
				.join("\\n");
			const details = { failures };
			reportResult("fail", message, details);
			return;
		}
		reportResult("pass", "WPT subtests passed");
	}

	function recordSuccess(name) {
		pendingNames.delete(name);
		reportOk(name);
		pending -= 1;
		maybeFinish();
	}

	function recordFailure(name, error) {
		pendingNames.delete(name);
		failures.push({ name, error: formatError(error) });
		pending -= 1;
		maybeFinish();
	}

	function makeTestContext() {
		return {
			step_timeout(callback, ms) {
				return setTimeout(callback, ms);
			},
			unreached_func(message) {
				return () => {
					throw new Error(message || "Unexpected function call");
				};
			},
			step_func(callback) {
				return (...args) => callback(...args);
			},
		};
	}

	function registerTest(name, run) {
		pending += 1;
		pendingNames.add(name);
		Promise.resolve()
			.then(run)
			.then(() => recordSuccess(name))
			.catch((error) => recordFailure(name, error));
	}

	function assertEqualsInternal(actual, expected, message) {
		if (actual !== expected) {
			const detail =
				"expected=" +
				JSON.stringify(expected) +
				", actual=" +
				JSON.stringify(actual);
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	}

	window.test = (callback, name = "unnamed test") => {
		registerTest(name, async () => {
			callback(makeTestContext());
		});
	};

	window.promise_test = (callback, name = "unnamed promise_test") => {
		registerTest(name, async () => {
			await callback(makeTestContext());
		});
	};

	window.async_test = (name = "unnamed async_test") => {
		pending += 1;
		pendingNames.add(name);
		let settled = false;
		const finish = (fn) => (...args) => {
			if (settled) return;
			settled = true;
			try {
				fn(...args);
				recordSuccess(name);
			} catch (error) {
				recordFailure(name, error);
			}
		};
		return {
			step_func_done(fn = () => {}) {
				return finish(fn);
			},
			done: finish(() => {}),
			step_func(fn) {
				return (...args) => fn(...args);
			},
		};
	};

	window.assert_equals = assertEqualsInternal;
	window.assert_true = (value, message) => {
		if (!value) throw new Error(message || "Expected value to be truthy");
	};
	window.assert_own_property = (object, key, message) => {
		if (!Object.prototype.hasOwnProperty.call(object, key)) {
			throw new Error(message || "Missing own property " + String(key));
		}
	};
	window.assert_in_array = (value, values, message) => {
		if (!Array.isArray(values) || !values.includes(value)) {
			const detail =
				"expected one of " +
				JSON.stringify(values) +
				", actual=" +
				JSON.stringify(value);
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	};
	window.assert_unreached = (message) => {
		throw new Error(message || "Reached unreachable code");
	};

	window.add_completion_callback = () => {};
	window.setup = () => {};

	window.addEventListener("error", (event) => {
		if (finished) return;
		failures.push({
			name: "window error",
			error: formatError(event.error || event.message),
		});
	});

	window.addEventListener("unhandledrejection", (event) => {
		if (finished) return;
		failures.push({
			name: "unhandled rejection",
			error: formatError(event.reason),
		});
	});

	window.addEventListener("load", () => {
		loadFired = true;
		stuckTimer = setTimeout(() => {
			if (finished || pending === 0) return;
			finished = true;
			const details = {
				pending: [...pendingNames],
				failures,
				loadFired,
			};
			reportResult("fail", "WPT tests stuck before completion", details);
		}, 12000);
		setTimeout(maybeFinish, 0);
	});
})();
`;

const WPT_TESTHARNESSREPORT_JS = `window.__wptReportLoaded = true;`;

function mimeType(filePath: string) {
	if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
	if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
	if (filePath.endsWith(".headers")) return "text/plain; charset=utf-8";
	return "application/octet-stream";
}

function escapeForSingleQuotedJs(value: string) {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\r/g, "\\r")
		.replace(/\n/g, "\\n");
}

function stripPort(hostname: string) {
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(1, end);
	}
	return hostname.split(":")[0] || hostname;
}

function replaceWptTokens(
	source: string,
	props: {
		host: string;
		httpPort: number;
		httpsPort: number;
		crossHost: string;
	}
) {
	return source
		.replaceAll("{{host}}", props.host)
		.replaceAll("{{domains[www1]}}", props.crossHost)
		.replaceAll("{{domains[www2]}}", props.crossHost)
		.replaceAll("{{hosts[alt][]}}", props.crossHost)
		.replaceAll("{{hosts[alt][www2]}}", props.crossHost)
		.replaceAll("{{ports[http][0]}}", String(props.httpPort))
		.replaceAll("{{ports[http][1]}}", String(props.httpPort))
		.replaceAll("{{ports[https][0]}}", String(props.httpsPort))
		.replaceAll("{{ports[https][1]}}", String(props.httpsPort))
		.replaceAll("{{ports[ws][0]}}", String(props.httpPort))
		.replaceAll("{{ports[wss][0]}}", String(props.httpsPort));
}

function parseHeadersFile(source: string) {
	const headers = new Map<string, string>();
	for (const line of source.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const index = trimmed.indexOf(":");
		if (index === -1) continue;
		const key = trimmed.slice(0, index).trim();
		const value = trimmed.slice(index + 1).trim();
		headers.set(key, value);
	}
	return headers;
}

async function listen(server: http.Server | https.Server): Promise<number> {
	return new Promise((resolve) => {
		server.listen(0, "0.0.0.0", () => {
			resolve((server.address() as AddressInfo).port);
		});
	});
}

async function close(server?: http.Server | https.Server) {
	if (!server) return;
	await new Promise<void>((resolve) => {
		server.closeAllConnections?.();
		server.close(() => resolve());
	});
}

async function collectVendoredWptPages() {
	const pages: string[] = [];

	async function walk(rootPrefix: string, current: string) {
		const entries = await fs.readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(rootPrefix, fullPath);
				continue;
			}
			if (entry.name === "fetch.http.html") {
				pages.push(path.relative(rootPrefix, fullPath).replaceAll("\\", "/"));
			}
		}
	}

	try {
		for (const root of REFERRER_GENERATED_ROOTS) {
			await walk(vendorRoot, path.join(vendorRoot, root));
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}

	pages.push(...REFERRER_INHERITANCE_PAGES);

	return pages.sort();
}

function testNameForPath(relPath: string) {
	return `wpt-${relPath.replaceAll(/[/.]+/g, "-")}`;
}

function maybeServeRedirect(
	requestUrl: URL,
	request: IncomingMessage,
	response: ServerResponse,
	ports: { httpPort: number; httpsPort: number }
) {
	const redirection = requestUrl.searchParams.get("redirection");
	if (!redirection || redirection === "no-redirect") return false;

	const hostHeader = request.headers.host || "localhost";
	const currentHost = stripPort(hostHeader);
	const currentProtocol = request.socket.encrypted ? "https:" : "http:";
	const target = new URL(requestUrl.toString());
	target.searchParams.delete("redirection");

	const swapHost = currentHost === "localhost" ? "127.0.0.1" : "localhost";
	const pickPort = (protocol: string) =>
		protocol === "https:" ? ports.httpsPort : ports.httpPort;

	switch (redirection) {
		case "keep-origin":
			target.protocol = currentProtocol;
			target.hostname = currentHost;
			target.port = String(pickPort(currentProtocol));
			break;
		case "swap-origin":
			target.protocol = currentProtocol;
			target.hostname = swapHost;
			target.port = String(pickPort(currentProtocol));
			break;
		case "keep-scheme":
			target.protocol = currentProtocol;
			target.port = String(pickPort(currentProtocol));
			break;
		case "swap-scheme": {
			const protocol = currentProtocol === "https:" ? "http:" : "https:";
			target.protocol = protocol;
			target.port = String(pickPort(protocol));
			break;
		}
		case "downgrade":
			target.protocol =
				currentProtocol === "https:" ? "http:" : currentProtocol;
			target.port = String(pickPort(target.protocol));
			break;
		default:
			return false;
	}

	response.writeHead(301, {
		"Access-Control-Allow-Origin": "*",
		Location: target.toString(),
	});
	response.end();
	return true;
}

function headersJson(request: IncomingMessage) {
	return JSON.stringify(request.headers, null, 4);
}

function serveTemplateResponse(
	response: ServerResponse,
	body: string,
	headers: Record<string, string> = {}
) {
	response.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Cache-Control": "no-cache; must-revalidate",
		...headers,
	});
	response.end(body);
}

async function createWptServer(): Promise<{
	httpServer: http.Server;
	httpsServer: https.Server;
	httpPort: number;
	httpsPort: number;
}> {
	const cert = await fs.readFile(path.join(testServerCertRoot, "cert.pem"));
	const key = await fs.readFile(path.join(testServerCertRoot, "key.pem"));

	let httpPort = 0;
	let httpsPort = 0;

	const handler = async (
		request: IncomingMessage,
		response: ServerResponse
	) => {
		try {
			const hostHeader = request.headers.host || "localhost";
			const requestHost = stripPort(hostHeader);
			const crossHost = requestHost === "localhost" ? "127.0.0.1" : "localhost";
			const protocol = request.socket.encrypted ? "https" : "http";
			const requestUrl = new URL(
				request.url || "/",
				`${protocol}://${hostHeader}`
			);

			if (requestUrl.pathname === "/") {
				response.writeHead(404, {
					"Content-Type": "text/plain; charset=utf-8",
				});
				response.end("Missing WPT entry path");
				return;
			}

			if (
				requestUrl.pathname === "/resources/testharness.js" ||
				requestUrl.pathname === "/resources/testharnessreport.js"
			) {
				const body =
					requestUrl.pathname === "/resources/testharness.js"
						? WPT_TESTHARNESS_JS
						: WPT_TESTHARNESSREPORT_JS;
				serveTemplateResponse(response, body, {
					"Content-Type": "application/javascript; charset=utf-8",
				});
				return;
			}

			if (requestUrl.pathname === "/common/get-host-info.sub.js") {
				const source = await fs.readFile(
					path.join(vendorRoot, "common/get-host-info.sub.js"),
					"utf8"
				);
				serveTemplateResponse(
					response,
					replaceWptTokens(source, {
						host: requestHost,
						httpPort,
						httpsPort,
						crossHost,
					}),
					{ "Content-Type": "application/javascript; charset=utf-8" }
				);
				return;
			}

			if (
				requestUrl.pathname ===
				"/common/security-features/resources/common.sub.js"
			) {
				const source = await fs.readFile(
					path.join(
						vendorRoot,
						"common/security-features/resources/common.sub.js"
					),
					"utf8"
				);
				serveTemplateResponse(
					response,
					replaceWptTokens(source, {
						host: requestHost,
						httpPort,
						httpsPort,
						crossHost,
					}),
					{ "Content-Type": "application/javascript; charset=utf-8" }
				);
				return;
			}

			if (
				requestUrl.pathname === "/common/security-features/subresource/xhr.py"
			) {
				if (
					maybeServeRedirect(requestUrl, request, response, {
						httpPort,
						httpsPort,
					})
				) {
					return;
				}
				serveTemplateResponse(
					response,
					JSON.stringify({ headers: request.headers }),
					{
						"Content-Type": "application/json; charset=utf-8",
					}
				);
				return;
			}

			if (
				requestUrl.pathname ===
				"/common/security-features/subresource/document.py"
			) {
				if (
					maybeServeRedirect(requestUrl, request, response, {
						httpPort,
						httpsPort,
					})
				) {
					return;
				}
				const template = await fs.readFile(
					path.join(
						vendorRoot,
						"common/security-features/subresource/template/document.html.template"
					),
					"utf8"
				);
				const body = template.replace("%(headers)s", headersJson(request));
				serveTemplateResponse(response, body, {
					"Content-Type": "text/html; charset=utf-8",
				});
				return;
			}

			if (
				requestUrl.pathname ===
				"/common/security-features/subresource/referrer.py"
			) {
				const referer = String(request.headers.referer || "");
				serveTemplateResponse(
					response,
					`window.referrer = '${escapeForSingleQuotedJs(referer)}';`,
					{
						"Content-Type": "application/javascript; charset=utf-8",
					}
				);
				return;
			}

			if (
				requestUrl.pathname === "/common/security-features/scope/document.py"
			) {
				const policyDeliveries = JSON.parse(
					requestUrl.searchParams.get("policyDeliveries") || "[]"
				) as Array<{
					deliveryType: string;
					key: string;
					value: string;
				}>;
				let meta = "";
				let error = "";
				const extraHeaders: Record<string, string> = {};

				for (const delivery of policyDeliveries) {
					if (delivery.deliveryType === "meta") {
						if (delivery.key === "referrerPolicy") {
							meta += `<meta name="referrer" content="${delivery.value}">`;
						} else {
							error = "invalid delivery key";
						}
					} else if (delivery.deliveryType === "http-rp") {
						if (delivery.key === "referrerPolicy") {
							extraHeaders["Referrer-Policy"] = delivery.value;
						} else {
							error = "invalid delivery key";
						}
					} else {
						error = "invalid deliveryType";
					}
				}

				const template = await fs.readFile(
					path.join(
						vendorRoot,
						"common/security-features/scope/template/document.html.template"
					),
					"utf8"
				);
				const body = template
					.replace("%(meta)s", meta)
					.replace("%(error)s", error);
				serveTemplateResponse(response, body, {
					"Content-Type": "text/html; charset=utf-8",
					...extraHeaders,
				});
				return;
			}

			if (requestUrl.pathname === "/__runway_report") {
				const token = requestUrl.searchParams.get("token") || "";
				const callback = reportCallbacks.get(token);
				if (!callback) {
					response.writeHead(404, {
						"Access-Control-Allow-Origin": "*",
						"Content-Type": "text/plain; charset=utf-8",
					});
					response.end("Unknown runway report token");
					return;
				}
				let body = "";
				request.on("data", (chunk) => {
					body += String(chunk);
				});
				request.on("end", async () => {
					try {
						const parsed = JSON.parse(body || "{}") as {
							status?: "pass" | "fail";
							message?: string;
							details?: any;
						};
						if (parsed.status === "pass") {
							await callback.pass(parsed.message, parsed.details);
						} else {
							await callback.fail(
								parsed.message || "WPT reported failure",
								parsed.details
							);
						}
						response.writeHead(204, {
							"Access-Control-Allow-Origin": "*",
						});
						response.end();
					} catch (error) {
						response.writeHead(500, {
							"Access-Control-Allow-Origin": "*",
							"Content-Type": "text/plain; charset=utf-8",
						});
						response.end(error instanceof Error ? error.stack : String(error));
					}
				});
				return;
			}

			const relativePath = requestUrl.pathname.replace(/^\/+/, "");
			const filePath = path.join(vendorRoot, relativePath);
			if (!filePath.startsWith(vendorRoot)) {
				response.writeHead(403);
				response.end("Forbidden");
				return;
			}

			let body: string;
			try {
				body = await fs.readFile(filePath, "utf8");
			} catch {
				response.writeHead(404, {
					"Content-Type": "text/plain; charset=utf-8",
				});
				response.end("Not found");
				return;
			}
			const headers: Record<string, string> = {
				"Content-Type": mimeType(filePath),
			};

			try {
				const headerSource = await fs.readFile(`${filePath}.headers`, "utf8");
				const parsedHeaders = parseHeadersFile(headerSource);
				for (const [key, value] of parsedHeaders) {
					headers[key] = value;
				}
			} catch {
				// No WPT .headers file for this resource.
			}

			serveTemplateResponse(
				response,
				replaceWptTokens(body, {
					host: requestHost,
					httpPort,
					httpsPort,
					crossHost,
				}),
				headers
			);
		} catch (error) {
			response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			response.end(error instanceof Error ? error.stack : String(error));
		}
	};

	const httpServer = http.createServer((request, response) => {
		void handler(request, response);
	});
	const httpsServer = https.createServer({ cert, key }, (request, response) => {
		void handler(request, response);
	});

	httpPort = await listen(httpServer);
	httpsPort = await listen(httpsServer);

	return { httpServer, httpsServer, httpPort, httpsPort };
}

let sharedServerPromise:
	| Promise<{
			httpServer: http.Server;
			httpsServer: https.Server;
			httpPort: number;
			httpsPort: number;
	  }>
	| undefined;
const reportCallbacks = new Map<
	string,
	{
		pass: (message?: string, details?: any) => Promise<void>;
		fail: (message?: string, details?: any) => Promise<void>;
	}
>();

async function ensureSharedWptServer() {
	if (!sharedServerPromise) {
		sharedServerPromise = createWptServer();
	}
	return await sharedServerPromise;
}

function wptPageTest(entryPath: string): Test {
	const basePath = `/${entryPath}`;
	const test: Test = {
		name: testNameForPath(entryPath),
		port: 0,
		path: basePath,
		scramjetOnly: true,
		reloadHarness: true,
		topLevelScramjet: false,
		warmProxiedNavigation: true,
		timeoutMs: 15000,
		async start({ pass, fail }) {
			const servers = await ensureSharedWptServer();
			test.port = servers.httpPort;
			const token = randomUUID();
			reportCallbacks.set(token, { pass, fail });
			const url = new URL(basePath, "http://localhost");
			url.searchParams.set(
				"runway_report",
				`http://localhost:${servers.httpPort}/__runway_report?token=${token}`
			);
			test.path = `${url.pathname}${url.search}`;
		},
		async stop() {
			const currentPath = test.path ?? basePath;
			const currentUrl = new URL(currentPath, "http://localhost");
			const reportUrl = currentUrl.searchParams.get("runway_report");
			if (reportUrl) {
				const reportToken = new URL(reportUrl).searchParams.get("token");
				if (reportToken) {
					reportCallbacks.delete(reportToken);
				}
			}
			test.path = basePath;
		},
	};
	return test;
}

const pages = await collectVendoredWptPages();

export default pages.map((page) => wptPageTest(page));

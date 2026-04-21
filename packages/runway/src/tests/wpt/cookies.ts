import http from "http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../testcommon.ts";
import { COOKIE_WPT_PAGES } from "./selection.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vendorRoot = path.join(__dirname, "vendored");

const WPT_TESTHARNESS_JS = `
(() => {
	const failures = [];
	const pendingNames = new Set();
	const resultCallbacks = [];
	const completionCallbacks = [];
	let sequence = Promise.resolve();
	let pending = 0;
	let loadFired = false;
	let finished = false;
	let stuckTimer = null;
	const runwayReport = new URL(location.href).searchParams.get("runway_report");

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

	async function runCleanups(cleanups) {
		for (const cleanup of cleanups) {
			try {
				await cleanup();
			} catch (error) {
				failures.push({ name: "cleanup", error: formatError(error) });
			}
		}
	}

	function notifyResult() {
		for (const callback of resultCallbacks) {
			try {
				callback();
			} catch {}
		}
	}

	function maybeFinish() {
		if (finished || !loadFired || pending !== 0) return;
		finished = true;
		if (stuckTimer) {
			clearTimeout(stuckTimer);
			stuckTimer = null;
		}
		const result = failures.length
			? {
				status: "fail",
				message: failures.map((entry) => entry.name + ": " + entry.error).join("\\n"),
				details: { failures },
			}
			: { status: "pass", message: "WPT subtests passed", details: undefined };
		for (const callback of completionCallbacks) {
			try {
				callback(result);
			} catch {}
		}
		reportResult(result.status, result.message, result.details);
	}

	async function settle(name, cleanups, runner) {
		try {
			await runner();
			await runCleanups(cleanups);
			pendingNames.delete(name);
			pending -= 1;
			notifyResult();
			maybeFinish();
		} catch (error) {
			await runCleanups(cleanups);
			pendingNames.delete(name);
			failures.push({ name, error: formatError(error) });
			pending -= 1;
			notifyResult();
			maybeFinish();
		}
	}

	function makeContext(name, onDone) {
		const cleanups = [];
		let done = false;
		const succeed = async () => {
			if (done) return;
			done = true;
			await runCleanups(cleanups);
			pendingNames.delete(name);
			pending -= 1;
			notifyResult();
			maybeFinish();
		};
		const failWith = async (error) => {
			if (done) return;
			done = true;
			await runCleanups(cleanups);
			pendingNames.delete(name);
			failures.push({ name, error: formatError(error) });
			pending -= 1;
			notifyResult();
			maybeFinish();
		};
		const context = {
			add_cleanup(fn) {
				cleanups.push(fn);
			},
			step(fn) {
				try {
					fn.call(context);
				} catch (error) {
					failWith(error);
				}
			},
			step_timeout(callback, ms) {
				return setTimeout(() => {
					try {
						callback();
					} catch (error) {
						failWith(error);
					}
				}, ms);
			},
			step_func(fn) {
				return (...args) => {
					try {
						return fn(...args);
					} catch (error) {
						failWith(error);
						throw error;
					}
				};
			},
			step_func_done(fn = () => {}) {
				return async (...args) => {
					try {
						await fn(...args);
						await succeed();
					} catch (error) {
						await failWith(error);
					}
				};
			},
			unreached_func(message) {
				return () => {
					throw new Error(message || "Unexpected function call");
				};
			},
			done() {
				succeed();
			},
		};
		onDone?.(context);
		return { context, cleanups };
	}

	function registerTest(name, runnerFactory) {
		pending += 1;
		pendingNames.add(name);
		const { runner, cleanups } = runnerFactory();
		sequence = sequence.then(() => settle(name, cleanups, runner));
	}

	function assertEqualsInternal(actual, expected, message) {
		if (actual !== expected) {
			const detail = "expected=" + JSON.stringify(expected) + ", actual=" + JSON.stringify(actual);
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	}

	window.test = (callback, name = "unnamed test") => {
		registerTest(name, () => {
			const { context, cleanups } = makeContext(name);
			return {
				cleanups,
				runner: async () => callback(context),
			};
		});
	};
	window.promise_test = (callback, name = "unnamed promise_test") => {
		registerTest(name, () => {
			const { context, cleanups } = makeContext(name);
			return {
				cleanups,
				runner: async () => callback(context),
			};
		});
	};
	window.async_test = (callbackOrName, maybeName) => {
		const callback = typeof callbackOrName === "function" ? callbackOrName : null;
		const name =
			typeof callbackOrName === "string"
				? callbackOrName
				: maybeName || "unnamed async_test";
		pending += 1;
		pendingNames.add(name);
		let created;
		const { context, cleanups } = makeContext(name, (value) => {
			created = value;
		});
		if (callback) {
			Promise.resolve().then(() => callback.call(context, context)).catch(async (error) => {
				await runCleanups(cleanups);
				pendingNames.delete(name);
				failures.push({ name, error: formatError(error) });
				pending -= 1;
				notifyResult();
				maybeFinish();
			});
		}
		return created;
	};

	window.assert_equals = assertEqualsInternal;
	window.assert_true = (value, message) => {
		if (!value) throw new Error(message || "Expected value to be truthy");
	};
	window.assert_false = (value, message) => {
		if (value) throw new Error(message || "Expected value to be falsy");
	};
	window.assert_not_equals = (actual, expected, message) => {
		if (actual === expected) {
			const detail = "did not expect " + JSON.stringify(expected);
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	};
	window.assert_unreached = (message) => {
		throw new Error(message || "Reached unreachable code");
	};
	window.add_result_callback = (callback) => {
		resultCallbacks.push(callback);
	};
	window.add_completion_callback = (callback) => {
		completionCallbacks.push(callback);
	};
	window.setup = () => {};

	const deleteAllCookies = () => {
		if (typeof window.__runwayControl === "function") {
			return window.__runwayControl({ action: "clearCookies" });
		}
		return Promise.resolve();
	};
	window.test_driver = {
		delete_all_cookies: deleteAllCookies,
		set_test_context() {},
		bless(_message, callback = () => {}) {
			return Promise.resolve().then(() => callback());
		},
		click(element) {
			element.click();
			return Promise.resolve();
		},
	};

	window.addEventListener("error", (event) => {
		if (finished) return;
		failures.push({ name: "window error", error: formatError(event.error || event.message) });
	});
	window.addEventListener("unhandledrejection", (event) => {
		if (finished) return;
		failures.push({ name: "unhandled rejection", error: formatError(event.reason) });
	});
	window.addEventListener("load", () => {
		loadFired = true;
		stuckTimer = setTimeout(() => {
			if (finished || pending === 0) return;
			finished = true;
			reportResult("fail", "WPT tests stuck before completion", {
				pending: [...pendingNames],
				failures,
				loadFired,
			});
		}, 60000);
		setTimeout(maybeFinish, 0);
	});

})();
`;

const WPT_TESTHARNESSREPORT_JS = `window.__wptReportLoaded = true;`;
const WPT_TESTDRIVER_JS = `window.test_driver = window.test_driver || {
	delete_all_cookies() {
		if (typeof window.__runwayControl === "function") {
			return window.__runwayControl({ action: "clearCookies" });
		}
		return Promise.resolve();
	},
	set_test_context() {},
	bless(_message, callback = () => {}) {
		return Promise.resolve().then(() => callback());
	},
	click(element) {
		element.click();
		return Promise.resolve();
	},
};`;
const WPT_TESTDRIVER_VENDOR_JS = `window.test_driver_internal = window.test_driver_internal || {};`;

function testNameForPath(relPath: string) {
	return `wpt-${relPath.replace(/[/.]+/g, "-")}`;
}

function serve(
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

function normalizeUnsafeSetCookie(cookie: string) {
	const parts = cookie.split(";");
	const pair = parts.shift();
	if (pair === undefined) return cookie;

	const equalsIndex = pair.indexOf("=");
	if (equalsIndex === -1) {
		const value = pair.replace(/[\0\n\r]/g, " ");
		return [value, ...parts.map((part) => part.replace(/[\0\n\r]/g, " "))].join(
			";"
		);
	}

	const name = pair.slice(0, equalsIndex).replace(/[\0\n\r]/g, " ");
	const rawValue = pair.slice(equalsIndex + 1);
	const ctlMatch = /[\0\n\r]/.exec(rawValue);
	const value = ctlMatch ? rawValue.slice(0, ctlMatch.index) : rawValue;
	const attrs = parts.map((part) => part.replace(/[\0\n\r]/g, " "));

	return [`${name}=${value}`, ...attrs].join(";");
}

function requiresRawSetCookie(cookie: string) {
	for (const char of cookie) {
		const code = char.codePointAt(0) || 0;
		if (code === 0 || code === 0x0a || code === 0x0d || code > 0xff) {
			return true;
		}
	}

	return false;
}

function writeRawResponse(
	response: ServerResponse,
	status: number,
	headers: Record<string, string>,
	setCookies: string[],
	body: string
) {
	const socket = response.socket;
	if (!socket) throw new Error("Response socket unavailable");

	const bodyBuffer = Buffer.from(body, "utf8");
	const statusText = status === 302 ? "Found" : "OK";
	const headerLines = [
		`HTTP/1.1 ${status} ${statusText}`,
		...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
		...setCookies.map(
			(cookie) => `Set-Cookie: ${normalizeUnsafeSetCookie(cookie)}`
		),
		`Content-Length: ${bodyBuffer.byteLength}`,
		"Connection: close",
		"",
		"",
	].join("\r\n");

	socket.write(Buffer.from(headerLines, "utf8"));
	socket.write(bodyBuffer);
	socket.end();
}

function sendResponseWithCookies(
	request: IncomingMessage,
	response: ServerResponse,
	status: number,
	body: string,
	setCookies: string[],
	extraHeaders: Record<string, string> = {}
) {
	const headers = {
		...cookieResponseHeaders(request),
		"Content-Type": "application/json; charset=utf-8",
		...extraHeaders,
	};

	if (setCookies.some(requiresRawSetCookie)) {
		writeRawResponse(response, status, headers, setCookies, body);
		return;
	}

	for (const [key, value] of Object.entries(headers)) {
		response.setHeader(key, value);
	}
	if (setCookies.length) {
		response.setHeader("Set-Cookie", setCookies);
	}
	response.writeHead(status);
	response.end(body);
}

function stripPort(hostname: string) {
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(1, end);
	}
	return hostname.split(":")[0] || hostname;
}

function parseHeadersFile(source: string) {
	const headers = new Map<string, string>();
	for (const line of source.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const index = trimmed.indexOf(":");
		if (index === -1) continue;
		headers.set(
			trimmed.slice(0, index).trim(),
			trimmed.slice(index + 1).trim()
		);
	}
	return headers;
}

function replaceTokens(
	source: string,
	props: {
		host: string;
		httpPort: number;
		httpsPort: number;
		sameSiteHost: string;
		crossHost: string;
	}
) {
	return source
		.replace(/\{\{host\}\}/g, props.host)
		.replace(/\{\{domains\[www\]\}\}/g, props.sameSiteHost)
		.replace(/\{\{domains\[www1\]\}\}/g, props.sameSiteHost)
		.replace(/\{\{domains\[www2\]\}\}/g, props.sameSiteHost)
		.replace(/\{\{hosts\[alt\]\[\]\}\}/g, props.crossHost)
		.replace(/\{\{ports\[http\]\[0\]\}\}/g, String(props.httpPort))
		.replace(/\{\{ports\[https\]\[0\]\}\}/g, String(props.httpsPort))
		.replace(/https:\/\//g, "http://");
}

function mimeTypeForPath(filePath: string) {
	if (filePath.endsWith(".html") || filePath.endsWith(".sub.html")) {
		return "text/html; charset=utf-8";
	}
	if (filePath.endsWith(".js") || filePath.endsWith(".sub.js")) {
		return "application/javascript; charset=utf-8";
	}
	if (filePath.endsWith(".headers")) {
		return "text/plain; charset=utf-8";
	}
	return "application/octet-stream";
}

function vendoredPathForRequest(pathname: string) {
	const relPath = pathname.replace(/^\/+/, "");
	if (!relPath.startsWith("cookies/")) return null;
	const resolved = path.resolve(vendorRoot, relPath);
	if (!resolved.startsWith(vendorRoot)) return null;
	return resolved;
}

async function loadPages() {
	const pages: string[] = [];
	for (const page of COOKIE_WPT_PAGES) {
		try {
			await fs.access(path.join(vendorRoot, page));
			pages.push(page);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	return pages;
}

function cookieResponseHeaders(request: IncomingMessage) {
	const origin = request.headers.origin;
	return {
		"Access-Control-Allow-Origin": origin ? String(origin) : "*",
		"Access-Control-Allow-Credentials": "true",
		"Cache-Control": "no-cache",
		Expires: "Fri, 01 Jan 1990 00:00:00 GMT",
	};
}

function parseCookieHeader(request: IncomingMessage) {
	const rawCookie = request.headers.cookie || "";
	const values = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
	const cookies: Record<string, string> = {};
	for (const entry of values.split(/;\s*/)) {
		if (!entry) continue;
		const index = entry.indexOf("=");
		if (index === -1) {
			cookies[entry] = "";
			continue;
		}
		cookies[entry.slice(0, index)] = entry.slice(index + 1);
	}
	return cookies;
}

async function serveVendoredFile(
	response: ServerResponse,
	requestPath: string,
	props: {
		host: string;
		httpPort: number;
		httpsPort: number;
		sameSiteHost: string;
		crossHost: string;
	}
) {
	const resolvedPath = vendoredPathForRequest(requestPath);
	if (!resolvedPath) return false;
	const headersPath = `${resolvedPath}.headers`;
	const source = await fs.readFile(resolvedPath, "utf8");
	const headers: Record<string, string> = {
		"Content-Type": mimeTypeForPath(resolvedPath),
	};
	try {
		const extraHeaders = parseHeadersFile(
			await fs.readFile(headersPath, "utf8")
		);
		for (const [key, value] of extraHeaders) headers[key] = value;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	serve(response, replaceTokens(source, props), headers);
	return true;
}

const pages = await loadPages();

let sharedServerPromise:
	| Promise<{
			server: http.Server;
			port: number;
	  }>
	| undefined;
const reportCallbacks = new Map<
	string,
	{
		pass: (message?: string, details?: any) => Promise<void>;
		fail: (message?: string, details?: any) => Promise<void>;
	}
>();

async function ensureServer() {
	if (!sharedServerPromise) {
		sharedServerPromise = (async () => {
			let port = 0;
			const server = http.createServer(
				{
					// Reject h2c upgrade attempts so browsers fall back to HTTP/1.1.
					// Without this, <img> and other subresource loads fire onerror because
					// Chromium treats a failed h2c upgrade differently from a plain HTTP/1.1 response.
					shouldUpgradeCallback: (req: IncomingMessage) =>
						req.headers.upgrade?.toLowerCase() === "websocket",
				},
				async (request, response) => {
					try {
						const hostHeader = request.headers.host || "localhost";
						const requestHost = stripPort(hostHeader);
						const sameSiteHost =
							requestHost === "localhost" ? "www.localhost" : "localhost";
						const crossHost =
							requestHost === "127.0.0.1" ? "localhost" : "127.0.0.1";
						const requestUrl = new URL(
							request.url || "/",
							`http://${hostHeader}`
						);

						if (request.method === "OPTIONS") {
							const origin = request.headers.origin;
							response.writeHead(204, {
								"Access-Control-Allow-Origin": origin ? String(origin) : "*",
								"Access-Control-Allow-Credentials": "true",
								"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
								"Access-Control-Allow-Headers": "Content-Type",
								"Access-Control-Max-Age": "86400",
							});
							response.end();
							return;
						}

						if (requestUrl.pathname === "/resources/testharness.js") {
							serve(response, WPT_TESTHARNESS_JS, {
								"Content-Type": "application/javascript; charset=utf-8",
							});
							return;
						}
						if (requestUrl.pathname === "/resources/testharnessreport.js") {
							serve(response, WPT_TESTHARNESSREPORT_JS, {
								"Content-Type": "application/javascript; charset=utf-8",
							});
							return;
						}
						if (requestUrl.pathname === "/resources/testdriver.js") {
							serve(response, WPT_TESTDRIVER_JS, {
								"Content-Type": "application/javascript; charset=utf-8",
							});
							return;
						}
						if (requestUrl.pathname === "/resources/testdriver-vendor.js") {
							serve(response, WPT_TESTDRIVER_VENDOR_JS, {
								"Content-Type": "application/javascript; charset=utf-8",
							});
							return;
						}
						if (requestUrl.pathname === "/cookies/resources/cookie.py") {
							const encoded = requestUrl.searchParams.get("set");
							const setCookies: string[] = [];
							if (encoded) {
								const parsed = JSON.parse(encoded) as string | string[];
								for (const cookie of Array.isArray(parsed)
									? parsed
									: [parsed]) {
									setCookies.push(cookie);
								}
							}
							if (requestUrl.searchParams.has("location")) {
								sendResponseWithCookies(
									request,
									response,
									302,
									'{"redirect": true}',
									setCookies,
									{ Location: requestUrl.searchParams.get("location") || "/" }
								);
								return;
							}
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success": true}',
								setCookies
							);
							return;
						}
						if (requestUrl.pathname === "/cookies/resources/set.py") {
							const cookie = decodeURIComponent(requestUrl.search.slice(1));
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success": true}',
								[cookie]
							);
							return;
						}
						if (requestUrl.pathname === "/cookies/resources/drop.py") {
							const name = requestUrl.searchParams.get("name") || "";
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success": true}',
								[`${name}=; max-age=0; path=/`]
							);
							return;
						}
						if (requestUrl.pathname === "/cookies/resources/set-cookie.py") {
							const name = requestUrl.searchParams.get("name") || "";
							const cookiePath = requestUrl.searchParams.get("path") || "/";
							const sameSite = requestUrl.searchParams.get("samesite");
							const secure = requestUrl.searchParams.has("secure");
							let cookie = `${name}=1; Path=${cookiePath}; Expires=09 Jun 2030 10:18:14 GMT`;
							if (sameSite) cookie += `;SameSite=${sameSite}`;
							if (secure) cookie += ";Secure";
							sendResponseWithCookies(
								request,
								response,
								200,
								`{"success": true}`,
								[cookie]
							);
							return;
						}
						if (
							requestUrl.pathname === "/cookies/resources/list.py" ||
							requestUrl.pathname === "/cookies/resources/echo-json.py"
						) {
							serve(response, JSON.stringify(parseCookieHeader(request)), {
								...cookieResponseHeaders(request),
								"Content-Type": "application/json; charset=utf-8",
							});
							return;
						}
						if (requestUrl.pathname === "/__runway_report") {
							const token = requestUrl.searchParams.get("token") || "";
							const callback = reportCallbacks.get(token);
							if (!callback) {
								response.writeHead(404, { "Access-Control-Allow-Origin": "*" });
								response.end("Unknown runway report token");
								return;
							}
							let body = "";
							request.on("data", (chunk) => {
								body += String(chunk);
							});
							request.on("end", async () => {
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
								response.writeHead(204, { "Access-Control-Allow-Origin": "*" });
								response.end();
							});
							return;
						}

						// Intercept cookie-helper.sub.js to patch resetSameSiteCookies to
						// reuse the puppet window per origin. Opening a new popup for every
						// test takes ~10s each in Playwright, making large test files time out.
						if (
							requestUrl.pathname === "/cookies/resources/cookie-helper.sub.js"
						) {
							const resolvedPath = path.resolve(
								vendorRoot,
								"cookies/resources/cookie-helper.sub.js"
							);
							const source = await fs.readFile(resolvedPath, "utf8");
							// Replace the entire resetSameSiteCookies function with a version
							// that caches puppets per origin instead of opening/closing each time.
							const patched = source.replace(
								/async function resetSameSiteCookies\(origin, value\) \{[\s\S]*?\n\}/,
								`// Runway patch: cache puppet windows per origin to avoid Playwright
// popup creation overhead (~10s per popup open in headless Chrome).
var __runwayPuppetCache = window.__runwayPuppetCache || (window.__runwayPuppetCache = {});
async function resetSameSiteCookies(origin, value) {
  let w = __runwayPuppetCache[origin];
  if (!w || w.closed) {
    w = window.open(origin + "/cookies/samesite/resources/puppet.html");
    __runwayPuppetCache[origin] = w;
    await wait_for_message("READY", origin);
  }
  w.postMessage({type: "drop", useOwnOrigin: true}, "*");
  await wait_for_message("drop-complete", origin);
  if (origin == self.origin) {
    assert_dom_cookie("samesite_strict", value, false);
    assert_dom_cookie("samesite_lax", value, false);
    assert_dom_cookie("samesite_none", value, false);
    assert_dom_cookie("samesite_unspecified", value, false);
  }
  w.postMessage({type: "set", value: value, useOwnOrigin: true}, "*");
  await wait_for_message("set-complete", origin);
  if (origin == self.origin) {
    assert_dom_cookie("samesite_strict", value, true);
    assert_dom_cookie("samesite_lax", value, true);
    assert_dom_cookie("samesite_none", value, true);
    assert_dom_cookie("samesite_unspecified", value, true);
  }
}`
							);
							serve(
								response,
								replaceTokens(patched, {
									host: requestHost,
									httpPort: port,
									httpsPort: port,
									sameSiteHost,
									crossHost,
								}),
								{ "Content-Type": "application/javascript; charset=utf-8" }
							);
							return;
						}

						if (requestUrl.pathname === "/cookies/resources/setSameSite.py") {
							const value = requestUrl.search.slice(1);
							const setCookies = [
								`samesite_strict=${value}; SameSite=Strict; path=/`,
								`samesite_lax=${value}; SameSite=Lax; path=/`,
								`samesite_none=${value}; SameSite=None; Secure; path=/`,
								`samesite_unspecified=${value}; path=/`,
							];
							sendResponseWithCookies(request, response, 302, "", setCookies, {
								Location: "/cookies/samesite/resources/echo-cookies.html",
							});
							return;
						}

						if (requestUrl.pathname === "/cookies/resources/dropSameSite.py") {
							const setCookies = [
								`samesite_strict=; max-age=0; path=/`,
								`samesite_lax=; max-age=0; path=/`,
								`samesite_none=; max-age=0; SameSite=None; Secure; path=/`,
								`samesite_unspecified=; max-age=0; path=/`,
							];
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success":true}',
								setCookies
							);
							return;
						}

						if (
							requestUrl.pathname === "/cookies/resources/setSameSiteNone.py"
						) {
							const value = requestUrl.search.slice(1);
							const setCookies = [
								`samesite_none_insecure=${value}; SameSite=None; path=/`,
								`samesite_none_secure=${value}; SameSite=None; Secure; path=/`,
							];
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success":true}',
								setCookies
							);
							return;
						}

						if (
							requestUrl.pathname === "/cookies/resources/dropSameSiteNone.py"
						) {
							const setCookies = [
								`samesite_none_insecure=; max-age=0; path=/`,
								`samesite_none_secure=; max-age=0; Secure; path=/`,
							];
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success":true}',
								setCookies
							);
							return;
						}

						if (
							requestUrl.pathname ===
							"/cookies/resources/setSameSiteMultiAttribute.py"
						) {
							const value = requestUrl.search.slice(1);
							const setCookies = [
								`samesite_unsupported=${value}; SameSite=Unsupported; Secure; path=/`,
								`samesite_unsupported_none=${value}; SameSite=Unsupported; SameSite=None; Secure; path=/`,
								`samesite_unsupported_lax=${value}; SameSite=Unsupported; SameSite=Lax; path=/`,
								`samesite_unsupported_strict=${value}; SameSite=Unsupported; SameSite=Strict; path=/`,
								`samesite_none_unsupported=${value}; SameSite=None; SameSite=Unsupported; Secure; path=/`,
								`samesite_lax_unsupported=${value}; SameSite=Lax; SameSite=Unsupported; Secure; path=/`,
								`samesite_strict_unsupported=${value}; SameSite=Strict; SameSite=Unsupported; Secure; path=/`,
								`samesite_lax_none=${value}; SameSite=Lax; SameSite=None; Secure; path=/`,
								`samesite_lax_strict=${value}; SameSite=Lax; SameSite=Strict; path=/`,
								`samesite_strict_lax=${value}; SameSite=Strict; SameSite=Lax; path=/`,
							];
							sendResponseWithCookies(request, response, 302, "", setCookies, {
								Location: "/cookies/samesite/resources/echo-cookies.html",
							});
							return;
						}

						if (
							requestUrl.pathname ===
							"/cookies/resources/dropSameSiteMultiAttribute.py"
						) {
							const setCookies = [
								`samesite_unsupported=; max-age=0; path=/`,
								`samesite_unsupported_none=; max-age=0; path=/`,
								`samesite_unsupported_lax=; max-age=0; path=/`,
								`samesite_unsupported_strict=; max-age=0; path=/`,
								`samesite_none_unsupported=; max-age=0; path=/`,
								`samesite_lax_unsupported=; max-age=0; path=/`,
								`samesite_strict_unsupported=; max-age=0; path=/`,
								`samesite_lax_none=; max-age=0; path=/`,
								`samesite_lax_strict=; max-age=0; path=/`,
								`samesite_strict_lax=; max-age=0; path=/`,
							];
							sendResponseWithCookies(
								request,
								response,
								200,
								'{"success":true}',
								setCookies
							);
							return;
						}

						if (
							requestUrl.pathname ===
							"/cookies/resources/redirectWithCORSHeaders.py"
						) {
							const location = requestUrl.searchParams.get("location") || "/";
							const status = parseInt(
								requestUrl.searchParams.get("status") || "302",
								10
							);
							sendResponseWithCookies(request, response, status, "", [], {
								Location: location,
							});
							return;
						}

						if (requestUrl.pathname === "/cookies/resources/postToParent.py") {
							const cookies = parseCookieHeader(request);
							const cookiesJson = JSON.stringify(cookies);
							const html = `<!DOCTYPE html>
<script>
var data = ${cookiesJson};
data.domcookies = document.cookie;
data.type = "COOKIES";
if (window.parent !== window) window.parent.postMessage(data, "*");
if (window.top !== window && window.top !== window.parent) window.top.postMessage(data, "*");
if (window.opener) window.opener.postMessage(data, "*");
window.addEventListener("message", function(e) {
  if (e.data === "reload") window.location.reload();
});
</script>`;
							serve(response, html, {
								...cookieResponseHeaders(request),
								"Content-Type": "text/html; charset=utf-8",
							});
							return;
						}

						if (requestUrl.pathname === "/cookies/resources/imgIfMatch.py") {
							const name = requestUrl.searchParams.get("name") || "";
							const value = requestUrl.searchParams.get("value") || "";
							const cookies = parseCookieHeader(request);
							const imgCorsOrigin = request.headers.origin
								? String(request.headers.origin)
								: "*";
							const imgCorsHeaders = {
								"Cache-Control": "no-cache",
								"Access-Control-Allow-Origin": imgCorsOrigin,
								"Access-Control-Allow-Credentials": "true",
							};
							if (cookies[name] === value) {
								const PNG_1x1 = Buffer.from(
									"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
									"base64"
								);
								response.writeHead(200, {
									"Content-Type": "image/png",
									...imgCorsHeaders,
								});
								response.end(PNG_1x1);
							} else {
								response.writeHead(404, {
									"Content-Type": "text/plain",
									...imgCorsHeaders,
								});
								response.end("Cookie not found");
							}
							return;
						}

						if (
							await serveVendoredFile(response, requestUrl.pathname, {
								host: requestHost,
								httpPort: port,
								httpsPort: port,
								sameSiteHost,
								crossHost,
							})
						) {
							return;
						}

						response.writeHead(404, {
							"Content-Type": "text/plain; charset=utf-8",
						});
						response.end("Not found");
					} catch (error) {
						response.writeHead(500, {
							"Content-Type": "text/plain; charset=utf-8",
						});
						response.end(
							error instanceof Error
								? error.stack || error.message
								: String(error)
						);
					}
				}
			);
			await new Promise<void>((resolve) => server.listen(0, resolve));
			port = (server.address() as AddressInfo).port;
			return { server, port };
		})();
	}
	return sharedServerPromise;
}

function cookiePageTest(entryPath: string): Test {
	const basePath = `/${entryPath}`;
	const test: Test = {
		name: testNameForPath(entryPath),
		port: 0,
		scheme: "http",
		path: basePath,
		scramjetOnly: true,
		reloadHarness: true,
		timeoutMs: 90000,
		async start({ pass, fail }) {
			const serverInfo = await ensureServer();
			test.port = serverInfo.port;
			const token = randomUUID();
			reportCallbacks.set(token, { pass, fail });
			const url = new URL(basePath, "http://localhost");
			url.searchParams.set(
				"runway_report",
				`http://localhost:${test.port}/__runway_report?token=${token}`
			);
			test.path = `${url.pathname}${url.search}`;
		},
		async stop() {
			const currentUrl = new URL(test.path ?? basePath, "http://localhost");
			const reportUrl = currentUrl.searchParams.get("runway_report");
			if (reportUrl) {
				const reportToken = new URL(reportUrl).searchParams.get("token");
				if (reportToken) reportCallbacks.delete(reportToken);
			}
			test.path = basePath;
		},
	};
	return test;
}

export default pages.map((page) => cookiePageTest(page));

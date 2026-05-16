import http from "http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../testcommon.ts";
import {
	FETCH_METADATA_PAGE_FILES_LIST,
	includeFetchMetadataGeneratedFile,
	includeFetchMetadataPageFile,
} from "./selection.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vendorRoot = path.join(__dirname, "vendored");

const WPT_TESTHARNESS_JS = `
(() => {
	const failures = [];
	const pendingNames = new Set();
	const skipPatterns = new URL(location.href).searchParams.getAll("runway_skip");
	let pending = 0;
	let loadFired = false;
	let finished = false;
	let stuckTimer = null;
	const runwayReport = new URL(location.href).searchParams.get("runway_report");

	function shouldSkip(name) {
		return skipPatterns.some((pattern) => name.includes(pattern));
	}

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
			reportResult(
				"fail",
				failures.map((entry) => entry.name + ": " + entry.error).join("\\n"),
				{ failures }
			);
			return;
		}
		reportResult("pass", "WPT subtests passed");
	}

	function recordSuccess(name) {
		pendingNames.delete(name);
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
			add_cleanup() {},
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
		if (shouldSkip(name)) return;
		pending += 1;
		pendingNames.add(name);
		Promise.resolve().then(run).then(() => recordSuccess(name)).catch((error) => recordFailure(name, error));
	}

	function assertEqualsInternal(actual, expected, message) {
		if (actual !== expected) {
			const detail = "expected=" + JSON.stringify(expected) + ", actual=" + JSON.stringify(actual);
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
		if (shouldSkip(name)) {
			return {
				step_func_done(fn = () => {}) {
					return (...args) => fn(...args);
				},
				done() {},
				step_func(fn) {
					return (...args) => fn(...args);
				},
				add_cleanup() {},
			};
		}
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
			add_cleanup() {},
		};
	};

	window.assert_equals = assertEqualsInternal;
	window.assert_not_equals = (actual, expected, message) => {
		if (actual === expected) {
			const detail = "expected not to equal " + JSON.stringify(expected);
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	};
	window.assert_array_equals = (actual, expected, message) => {
		const actualJson = JSON.stringify(actual);
		const expectedJson = JSON.stringify(expected);
		if (actualJson !== expectedJson) {
			const detail = "expected=" + expectedJson + ", actual=" + actualJson;
			throw new Error(message ? message + " (" + detail + ")" : detail);
		}
	};
	window.assert_true = (value, message) => {
		if (!value) throw new Error(message || "Expected value to be truthy");
	};
	window.assert_own_property = (object, key, message) => {
		if (!Object.prototype.hasOwnProperty.call(object, key)) {
			throw new Error(message || "Missing own property " + String(key));
		}
	};
	window.assert_not_own_property = (object, key, message) => {
		if (Object.prototype.hasOwnProperty.call(object, key)) {
			throw new Error(message || "Unexpected own property " + String(key));
		}
	};
	window.assert_implements_optional = () => {};
	window.setup = () => {};
	window.add_completion_callback = () => {};
	// We deliberately don't try to fake transient user activation. Tests in the
	// fetch-metadata suite that gate assertions on \`test_driver.bless(...)\`
	// (anchor click navigation, form submission, popped windows, etc.) are
	// excluded at the selection layer instead — see selection.ts. These stubs
	// keep the harness from crashing if a vendored test happens to reach for
	// them, but they don't grant activation.
	window.test_driver = {
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
		}, 12000);
		setTimeout(maybeFinish, 0);
	});
})();
`;

const WPT_TESTHARNESSREPORT_JS = "window.__wptReportLoaded = true;";
const WPT_TESTDRIVER_JS = `window.test_driver = window.test_driver || {
	bless(_message, callback = () => {}) {
		return Promise.resolve().then(() => callback());
	},
	click(element) {
		element.click();
		return Promise.resolve();
	},
};`;
const WPT_TESTDRIVER_VENDOR_JS =
	"window.test_driver_internal = window.test_driver_internal || {};";
const WPT_SERVICE_WORKER_HELPERS_JS = `
function with_iframe(url) {
	return new Promise((resolve, reject) => {
		const frame = document.createElement('iframe');
		frame.onload = () => resolve(frame);
		frame.onerror = () => reject(new Error('iframe failed to load: ' + url));
		frame.src = url;
		document.body.appendChild(frame);
	});
}

function wait_for_state(_test, worker, state) {
	return new Promise((resolve, reject) => {
		if (!worker) {
			reject(new Error('Missing worker'));
			return;
		}
		if (worker.state === state) {
			resolve(worker);
			return;
		}
		worker.addEventListener('statechange', function onStateChange() {
			if (worker.state === state) {
				worker.removeEventListener('statechange', onStateChange);
				resolve(worker);
			}
		});
	});
}

function service_worker_unregister_and_register(test, script, scope) {
	return navigator.serviceWorker.getRegistration(scope)
		.then((registration) => {
			if (registration) {
				return registration.unregister();
			}
		})
		.then(() => navigator.serviceWorker.register(script, { scope }))
		.then((registration) => {
			test.add_cleanup(() => registration.unregister());
			return registration;
		});
}
`;

function testNameForPath(relPath: string) {
	return `wpt-${relPath.replaceAll(/[/.]+/g, "-")}`;
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

function stripPort(hostname: string) {
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(1, end);
	}
	return hostname.split(":")[0] || hostname;
}

function replaceTokens(
	source: string,
	props: {
		host: string;
		httpPort: number;
		httpsPort: number;
		sameSiteHost: string;
		crossHost: string;
		searchParams?: URLSearchParams;
		requestHeaders?: Record<string, string>;
	}
) {
	return (
		source
			.replaceAll("{{host}}", props.host)
			.replaceAll("{{hosts[][www]}}", props.sameSiteHost)
			.replaceAll("{{hosts[alt][]}}", props.crossHost)
			.replaceAll("{{hosts[alt][www]}}", props.sameSiteHost)
			.replaceAll("{{ports[http][0]}}", String(props.httpPort))
			.replaceAll("{{ports[https][0]}}", String(props.httpsPort))
			.replaceAll(
				/\{\{GET\[([^\]]+)\]\}\}/g,
				(_match, key: string) => props.searchParams?.get(key) ?? ""
			)
			// `{{headers[name]}}` echoes the value of an incoming request header.
			// wptserve does this server-side; we mirror it here so tests like
			// fetch/metadata/navigation.https.sub.html can assert on the page's
			// own request headers.
			.replaceAll(
				/\{\{headers\[([^\]]+)\]\}\}/gi,
				(_match, key: string) => props.requestHeaders?.[key.toLowerCase()] ?? ""
			)
			// Each `{{uuid()}}` should yield a distinct UUID per match, mirroring
			// wptserve's behaviour. Use a function-replacement so the closure runs
			// once per occurrence instead of substituting a single fixed value.
			.replaceAll(/\{\{uuid\(\)\}\}/g, () => randomUUID())
	);
}

function pickFirstHeader(
	headers: Record<string, string[] | string | undefined>,
	name: string
): string {
	const value = headers[name.toLowerCase()];
	if (Array.isArray(value)) return value[0] ?? "";
	if (typeof value === "string") return value;
	return "";
}

function normalizeHeaders(request: IncomingMessage) {
	const grouped = new Map<string, string[]>();
	for (let i = 0; i < request.rawHeaders.length; i += 2) {
		const key = request.rawHeaders[i]!.toLowerCase();
		const value = request.rawHeaders[i + 1] ?? "";
		grouped.set(key, [...(grouped.get(key) ?? []), value]);
	}
	return Object.fromEntries(grouped);
}

function mimeTypeForPath(filePath: string) {
	if (filePath.endsWith(".html") || filePath.endsWith(".sub.html")) {
		return "text/html; charset=utf-8";
	}
	if (filePath.endsWith(".js") || filePath.endsWith(".sub.js")) {
		return "application/javascript; charset=utf-8";
	}
	if (filePath.endsWith(".json")) {
		return "application/json; charset=utf-8";
	}
	return "text/plain; charset=utf-8";
}

async function loadGeneratedPages() {
	const generatedRoot = path.join(vendorRoot, "fetch/metadata/generated");
	let entries;
	try {
		entries = await fs.readdir(generatedRoot, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => `fetch/metadata/generated/${entry.name}`)
		.filter((entry) => includeFetchMetadataGeneratedFile(entry))
		.sort();
}

/**
 * Top-level (non-generated) `fetch/metadata/*.https.sub.html` and `*.https.html`
 * pages we vendor in addition to the generated suite — see selection.ts.
 */
async function loadPagePages() {
	const pages: string[] = [];
	for (const relPath of FETCH_METADATA_PAGE_FILES_LIST) {
		if (!includeFetchMetadataPageFile(relPath)) continue;
		// Skip non-html sidecar files (e.g. `.sub.headers`); they're served
		// alongside but aren't independently runnable as test pages.
		if (!relPath.endsWith(".html")) continue;
		const absPath = path.join(vendorRoot, relPath);
		try {
			await fs.access(absPath);
			pages.push(relPath);
		} catch {
			// File hasn't been vendored yet (e.g. fresh checkout); silently skip.
		}
	}
	return pages.sort();
}

function vendoredPathForRequest(pathname: string) {
	const relPath = pathname.replace(/^\/+/, "");
	if (!relPath.startsWith("fetch/metadata/")) {
		return null;
	}
	const resolved = path.resolve(vendorRoot, relPath);
	if (!resolved.startsWith(vendorRoot)) {
		return null;
	}
	return resolved;
}

async function loadHeadersSidecar(
	resolvedPath: string,
	props: Parameters<typeof replaceTokens>[1]
): Promise<Record<string, string>> {
	const sidecarPath = `${resolvedPath}.sub.headers`;
	let raw: string;
	try {
		raw = await fs.readFile(sidecarPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {};
		}
		throw error;
	}
	const out: Record<string, string> = {};
	for (const line of replaceTokens(raw, props).split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colon = trimmed.indexOf(":");
		if (colon === -1) continue;
		const key = trimmed.slice(0, colon).trim();
		const value = trimmed.slice(colon + 1).trim();
		if (!key) continue;
		out[key] = value;
	}
	return out;
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
		searchParams: URLSearchParams;
		requestHeaders?: Record<string, string>;
	}
) {
	const resolvedPath = vendoredPathForRequest(requestPath);
	if (!resolvedPath) return false;
	let source: string;
	try {
		source = await fs.readFile(resolvedPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
	// Keep https:// URLs as-is — they're rerouted to the harness server by the
	// runway cleartext-https transport. This makes the WPT tests actually exercise
	// scheme distinctions (http vs https) for Sec-Fetch-Site.
	const body = replaceTokens(source, props);
	const sidecarHeaders = await loadHeadersSidecar(resolvedPath, props);
	serve(response, body, {
		"Content-Type": mimeTypeForPath(resolvedPath),
		...sidecarHeaders,
	});
	return true;
}

const pages = [...(await loadGeneratedPages()), ...(await loadPagePages())];

let sharedServerPromise:
	| Promise<{
			server: http.Server;
			port: number;
			headersByKey: Map<string, string>;
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
			const headersByKey = new Map<string, string>();
			let port = 0;
			const handle = async (
				request: IncomingMessage,
				response: ServerResponse
			) => {
				try {
					const hostHeader =
						request.headers.host || FETCH_METADATA_PRIMARY_HOST;
					const requestHost = stripPort(hostHeader);
					// Map the requesting host to the WPT-style same-site / cross-site
					// peers so that template substitutions in served pages resolve to
					// hosts that are actually wired into the cleartext transport snap.
					const sameSiteHost =
						requestHost === FETCH_METADATA_PRIMARY_HOST
							? FETCH_METADATA_SAME_SITE_HOST
							: FETCH_METADATA_PRIMARY_HOST;
					const crossHost =
						requestHost === FETCH_METADATA_CROSS_SITE_HOST
							? FETCH_METADATA_PRIMARY_HOST
							: FETCH_METADATA_CROSS_SITE_HOST;
					const requestUrl = new URL(
						request.url || "/",
						`http://${hostHeader}`
					);

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
					if (
						requestUrl.pathname ===
						"/service-workers/service-worker/resources/test-helpers.sub.js"
					) {
						serve(response, WPT_SERVICE_WORKER_HELPERS_JS, {
							"Content-Type": "application/javascript; charset=utf-8",
						});
						return;
					}
					if (requestUrl.pathname === "/fetch/api/resources/redirect.py") {
						const location = requestUrl.searchParams.get("location") || "/";
						response.writeHead(302, {
							Location: location,
							"Access-Control-Allow-Origin": "*",
						});
						response.end();
						return;
					}
					if (
						requestUrl.pathname ===
						"/fetch/metadata/resources/record-headers.py"
					) {
						const key = requestUrl.searchParams.get("key") || "";
						if (requestUrl.searchParams.has("retrieve")) {
							const body = headersByKey.get(key);
							if (!body) {
								response.writeHead(204, { "Access-Control-Allow-Origin": "*" });
								response.end();
								return;
							}
							serve(response, body, {
								"Content-Type": "application/json; charset=utf-8",
							});
							return;
						}
						const recorded = normalizeHeaders(request);
						headersByKey.set(key, JSON.stringify(recorded));
						if (process.env.RUNWAY_DEBUG_FETCH_METADATA === "1") {
							console.log(
								"[record-headers]",
								requestUrl.pathname + requestUrl.search,
								JSON.stringify(
									Object.fromEntries(
										Object.entries(recorded).filter(
											([k]) =>
												k.startsWith("sec-fetch") ||
												k === "x-scramjet-debug" ||
												k === "host" ||
												k === "origin" ||
												k === "referer"
										)
									)
								)
							);
						}
						const mime = requestUrl.searchParams.get("mime");
						const body = requestUrl.searchParams.get("body") || "";
						serve(response, body, mime ? { "Content-Type": mime } : {});
						return;
					}
					if (
						requestUrl.pathname === "/fetch/metadata/resources/header-link.py"
					) {
						const location = requestUrl.searchParams.get("location") || "/";
						const rel = requestUrl.searchParams.get("rel") || "preload";
						response.writeHead(200, {
							"Access-Control-Allow-Origin": "*",
							"Cache-Control": "no-cache; must-revalidate",
							"Content-Type": "text/html; charset=utf-8",
							Link: `<${location}>; rel=${rel}`,
						});
						response.end("");
						return;
					}
					if (
						requestUrl.pathname === "/fetch/metadata/resources/post-to-owner.py"
					) {
						const payload = JSON.stringify({
							dest: request.headers["sec-fetch-dest"] || "",
							mode: request.headers["sec-fetch-mode"] || "",
							site: request.headers["sec-fetch-site"] || "",
							user: request.headers["sec-fetch-user"] || "",
						});
						serve(
							response,
							`<!DOCTYPE html><script>
const data = ${payload};
if (window.opener) window.opener.postMessage(data, "*");
if (window.top !== window) window.top.postMessage(data, "*");
</script>`,
							{ "Content-Type": "text/html; charset=utf-8" }
						);
						return;
					}
					if (requestUrl.pathname === "/common/refresh.py") {
						const location = requestUrl.searchParams.get("location") || "/";
						response.writeHead(200, {
							"Access-Control-Allow-Origin": "*",
							"Cache-Control": "no-cache; must-revalidate",
							"Content-Type": "text/html; charset=utf-8",
							Refresh: `0; url=${location}`,
						});
						response.end("<!DOCTYPE html>");
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

					// Flatten request headers (lowercased keys, first value wins)
					// so served pages can substitute `{{headers[name]}}` —
					// `fetch/metadata/navigation.https.sub.html` and friends use
					// this to assert on their own request headers.
					const requestHeadersFlat: Record<string, string> = {};
					for (const [k, v] of Object.entries(request.headers)) {
						requestHeadersFlat[k.toLowerCase()] = Array.isArray(v)
							? (v[0] ?? "")
							: (v ?? "");
					}

					if (
						await serveVendoredFile(response, requestUrl.pathname, {
							host: requestHost,
							httpPort: port,
							httpsPort: port,
							sameSiteHost,
							crossHost,
							searchParams: requestUrl.searchParams,
							requestHeaders: requestHeadersFlat,
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
			};
			const server = http.createServer(handle);
			await new Promise<void>((resolve) => server.listen(0, resolve));
			port = (server.address() as AddressInfo).port;
			return {
				server,
				port,
				headersByKey,
			};
		})();
	}
	return sharedServerPromise;
}

// Use non-loopback fake hostnames so the WPT test setup matches its design
// assumption that http:// destinations are non-trustworthy. The runway
// cleartext transport rewrites all wire requests to 127.0.0.1:<port>.
const FETCH_METADATA_PRIMARY_HOST = "wpt.test";
const FETCH_METADATA_SAME_SITE_HOST = "www.wpt.test";
const FETCH_METADATA_CROSS_SITE_HOST = "wpt-cross.test";

function metadataPageTest(entryPath: string): Test {
	const basePath = `/${entryPath}`;
	// HTTPS variants of the WPT fetch-metadata tests run with a logical `https:`
	// page URL so that Sec-Fetch-Site treats https↔http as a scheme change
	// (cross-site). HTTP variants must use a non-loopback host so that
	// destinations are non-trustworthy and Sec-Fetch-* is omitted.
	const isHttpsVariant = /\.https\.(?:optional\.|tentative\.)?sub\.html$/.test(
		entryPath
	);
	const scheme: "http" | "https" = isHttpsVariant ? "https" : "http";
	const test: Test = {
		name: testNameForPath(entryPath),
		port: 0,
		scheme,
		hostname: FETCH_METADATA_PRIMARY_HOST,
		cleartextHosts: [
			FETCH_METADATA_SAME_SITE_HOST,
			FETCH_METADATA_CROSS_SITE_HOST,
		],
		// Embedded URLs in WPT helper.sub.js include the explicit `{{ports[*][0]}}`
		// substitution, so the loaded page URL must also include the harness
		// port to keep same-origin classifications consistent.
		useExplicitTargetPort: true,
		path: basePath,
		scramjetOnly: true,
		reloadHarness: true,
		timeoutMs: 15000,
		async start({ pass, fail }) {
			const serverInfo = await ensureServer();
			test.port = serverInfo.port;
			const token = randomUUID();
			reportCallbacks.set(token, { pass, fail });
			const baseOrigin = `${scheme}://${FETCH_METADATA_PRIMARY_HOST}:${test.port}`;
			const url = new URL(basePath, baseOrigin);
			url.searchParams.set(
				"runway_report",
				`${baseOrigin}/__runway_report?token=${token}`
			);
			test.path = `${url.pathname}${url.search}`;
		},
		async stop() {
			const baseOrigin = `${scheme}://${FETCH_METADATA_PRIMARY_HOST}:${test.port || 1}`;
			const currentUrl = new URL(test.path ?? basePath, baseOrigin);
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

export default pages.map((page) => metadataPageTest(page));

import { createStore } from "dreamland/core";

export type AvailableTransports = "libcurl" | "epoxy";

export const AVAILABLE_TRANSPORTS: ReadonlyArray<{
	value: AvailableTransports;
	label: string;
}> = [
	{ value: "libcurl", label: "Libcurl" },
	{ value: "epoxy", label: "Epoxy" },
];

export type SearchEngineId = "google" | "bing" | "duckduckgo" | "brave";

export const SEARCH_ENGINES: ReadonlyArray<{
	id: SearchEngineId;
	label: string;
	searchUrl: string;
}> = [
	{
		id: "google",
		label: "Google",
		searchUrl: "https://www.google.com/search?q=",
	},
	{
		id: "bing",
		label: "Bing",
		searchUrl: "https://www.bing.com/search?q=",
	},
	{
		id: "duckduckgo",
		label: "DuckDuckGo",
		searchUrl: "https://duckduckgo.com/?q=",
	},
	{
		id: "brave",
		label: "Brave",
		searchUrl: "https://search.brave.com/search?q=",
	},
];

export type ProxyShortcut = {
	id: string;
	name: string;
	url: string;
};

export const DEFAULT_SEARCH_ENGINE: SearchEngineId = "google";

export const proxyPreferencesStore = createStore(
	{
		searchEngine: DEFAULT_SEARCH_ENGINE as SearchEngineId,
		shortcuts: [] as ProxyShortcut[],
	},
	{
		ident: "tcms-proxy-preferences",
		backing: "localstorage",
		autosave: "auto",
	}
);

export function isSearchEngine(value: unknown): value is SearchEngineId {
	return SEARCH_ENGINES.some((engine) => engine.id === value);
}

export function getSearchEngine(value: unknown): SearchEngineId {
	return isSearchEngine(value) ? value : DEFAULT_SEARCH_ENGINE;
}

export function getSearchUrl(query: string, engine: unknown): string {
	const selected = getSearchEngine(engine);
	const searchEngine = SEARCH_ENGINES.find((item) => item.id === selected)!;
	return `${searchEngine.searchUrl}${encodeURIComponent(query.trim())}`;
}

function normalizeShortcutUrl(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	try {
		const parsed = new URL(withProtocol);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		return parsed.href;
	} catch {
		return null;
	}
}

/** Validate data received from local storage or the start-page iframe. */
export function sanitizeShortcuts(value: unknown): ProxyShortcut[] {
	if (!Array.isArray(value)) return [];

	const shortcuts: ProxyShortcut[] = [];
	const seenIds = new Set<string>();

	for (const [index, item] of value.entries()) {
		if (!item || typeof item !== "object") continue;

		const record = item as Record<string, unknown>;
		const name = String(record.name ?? "").trim().slice(0, 32);
		const url = normalizeShortcutUrl(String(record.url ?? "").slice(0, 2048));
		if (!name || !url) continue;

		let id = String(record.id ?? `shortcut-${index}`)
			.trim()
			.replace(/[^a-z0-9_-]/gi, "")
			.slice(0, 64);
		if (!id || seenIds.has(id)) id = `shortcut-${index}-${shortcuts.length}`;
		seenIds.add(id);
		shortcuts.push({ id, name, url });
		if (shortcuts.length >= 24) break;
	}

	return shortcuts;
}

const DEFAULT_WISP_URL = import.meta.env.VITE_WISP_URL || "/wisp/";
const DEFAULT_TRANSPORT: AvailableTransports = "libcurl";
const DEFAULT_MAX_REQUESTS = 200;

export const demoSettingsStore = createStore(
	{
		transport: DEFAULT_TRANSPORT as AvailableTransports,
		wispUrl: DEFAULT_WISP_URL,
		maxRequests: DEFAULT_MAX_REQUESTS,
	},
	{
		ident: "scramjet-demo-settings",
		backing: "localstorage",
		autosave: "auto",
	}
);

export function normalizeWispUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new TypeError("Wisp URL is required.");
	}

	let normalized = trimmed;
	if (normalized.startsWith("/")) {
		const protocol =
			typeof location !== "undefined" && location.protocol === "https:"
				? "wss:"
				: "ws:";
		const host =
			typeof location !== "undefined" ? location.host : "localhost";
		normalized = `${protocol}//${host}${normalized}`;
	} else if (!normalized.startsWith("ws://") && !normalized.startsWith("wss://")) {
		normalized = `ws://${normalized}`;
	}

	const parsed = new URL(normalized);
	if (!parsed.pathname || parsed.pathname === "") {
		parsed.pathname = "/";
	}
	if (!parsed.pathname.endsWith("/")) {
		parsed.pathname = `${parsed.pathname}/`;
	}

	return parsed.toString();
}

export function getRuntimeWispUrl(value: string) {
	const normalized = normalizeWispUrl(value);
	if (typeof window === "undefined" || !window.location.hostname.endsWith(".e2b.app")) {
		return normalized;
	}

	const parsed = new URL(normalized);
	if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
		return normalizeWispUrl("/wisp/");
	}
	return normalized;
}

export function normalizeTransport(value: string): AvailableTransports {
	if (AVAILABLE_TRANSPORTS.some((t) => t.value === value)) {
		return value as AvailableTransports;
	}
	throw new TypeError(`Unknown transport: ${value}`);
}

export function normalizeMaxRequests(value: string | number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new TypeError("Request log limit must be a number.");
	}

	const rounded = Math.round(parsed);
	if (rounded < 10 || rounded > 5000) {
		throw new RangeError("Request log limit must be between 10 and 5000.");
	}

	return rounded;
}

export const demoSettingsDefaults = {
	wispUrl: normalizeWispUrl(DEFAULT_WISP_URL),
	transport: DEFAULT_TRANSPORT,
	maxRequests: DEFAULT_MAX_REQUESTS,
};

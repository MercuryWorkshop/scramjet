/**
 * Wraps a ProxyTransport (e.g. LibcurlClient) so `https:` / `wss:` are executed cleartext
 * while BareCompatibleClient keeps the logical URL for `response.url` and redirects.
 *
 * **Site mapping** (`window.__runwayCleartextSite = { roots: string[], httpPort }`):
 * For each root in `roots`, requests to `https://root/…` or `https://sub.root/…` (default
 * port 443) or `https://…:httpPort` when the port matches the runway server, are sent as
 * `http://127.0.0.1:httpPort/…` with `Host: <logical hostname>`.
 *
 * Legacy shape `{ hostname, httpPort }` is still accepted (`hostname` treated as the only root).
 *
 * **Host allowlist** (`window.__runwayCleartextHttpsHosts`): cleartext https→http for
 * listed hosts without snap (legacy).
 *
 * `window.__runwayCleartextHttps = false` disables all rewriting.
 */
class RunwayCleartextHttpsTransport {
	/** @param {any} inner */
	constructor(inner) {
		this.inner = inner;
	}

	get ready() {
		return this.inner.ready;
	}

	init() {
		return this.inner.init();
	}

	/** @param {any} snap */
	#snapRoots(snap) {
		if (!snap) return [];
		if (Array.isArray(snap.roots) && snap.roots.length) return snap.roots;
		if (typeof snap.hostname === "string" && snap.hostname)
			return [snap.hostname];
		return [];
	}

	/** @param {string} host @param {any} snap */
	#hostMatchesSnapRoots(host, snap) {
		const roots = this.#snapRoots(snap);
		if (
			!roots.length ||
			typeof snap.httpPort !== "number" ||
			snap.httpPort <= 0
		) {
			return false;
		}
		return roots.some((r) => host === r || host.endsWith("." + r));
	}

	/** @param {[string, string][] | undefined} raw */
	#withLogicalHost(raw, logicalHostname) {
		const arr = Array.isArray(raw) ? [...raw] : [];
		const out = [];
		let replaced = false;
		for (const pair of arr) {
			if (pair[0].toLowerCase() === "host") {
				if (!replaced) {
					out.push(["Host", logicalHostname]);
					replaced = true;
				}
			} else {
				out.push(pair);
			}
		}
		if (!replaced) out.push(["Host", logicalHostname]);
		return out;
	}

	/**
	 * @param {URL} remote
	 * @returns {{ url: URL; logicalHostname: string | null }}
	 */
	#rewriteWithMeta(remote) {
		if (
			typeof window !== "undefined" &&
			window.__runwayCleartextHttps === false
		) {
			return { url: remote, logicalHostname: null };
		}
		const url = new URL(remote.href);
		const isHttps = url.protocol === "https:";
		const isWss = url.protocol === "wss:";
		if (!isHttps && !isWss) return { url: remote, logicalHostname: null };

		const snap =
			typeof window !== "undefined" && window.__runwayCleartextSite != null
				? window.__runwayCleartextSite
				: null;
		const host = url.hostname;
		const defaultTlsPort = url.port === "" || url.port === "443";
		const snapHost = snap && this.#hostMatchesSnapRoots(host, snap);

		const portMatchesServer =
			snap &&
			url.port !== "" &&
			url.port !== "443" &&
			url.port === String(snap.httpPort);

		if (snapHost && (defaultTlsPort || portMatchesServer)) {
			const wire = new URL("http://127.0.0.1/");
			wire.protocol = isWss ? "ws:" : "http:";
			wire.port = String(snap.httpPort);
			wire.pathname = url.pathname;
			wire.search = url.search;
			wire.hash = url.hash;
			return { url: wire, logicalHostname: host };
		}

		const list =
			typeof window !== "undefined"
				? window.__runwayCleartextHttpsHosts
				: undefined;
		const loopback =
			host === "localhost" || host === "127.0.0.1" || host === "[::1]";
		const explicit =
			Array.isArray(list) && list.length > 0 && list.includes(host);
		const implicitLoopback =
			(!Array.isArray(list) || list.length === 0) && loopback;
		if (!explicit && !implicitLoopback) {
			return { url: remote, logicalHostname: null };
		}

		const out = new URL(url.href);
		if (isHttps) out.protocol = "http:";
		if (isWss) out.protocol = "ws:";
		return { url: out, logicalHostname: null };
	}

	request(remote, method, body, headers, signal) {
		const { url: wire, logicalHostname } = this.#rewriteWithMeta(remote);
		const hdrs =
			logicalHostname != null
				? this.#withLogicalHost(headers, logicalHostname)
				: (headers ?? []);
		return this.inner.request(wire, method, body, hdrs, signal);
	}

	connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
		const { url: wire, logicalHostname } = this.#rewriteWithMeta(url);
		const hdrs =
			logicalHostname != null
				? this.#withLogicalHost(requestHeaders, logicalHostname)
				: (requestHeaders ?? []);
		return this.inner.connect(
			wire,
			protocols,
			hdrs,
			onopen,
			onmessage,
			onclose,
			onerror
		);
	}
}

window.RunwayCleartextHttpsTransport = RunwayCleartextHttpsTransport;

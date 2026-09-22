import { RawHeaders } from "@mercuryworkshop/proxy-transports";
import {
	String_startsWith,
	String_substring,
	String_toLowerCase,
} from "./snapshot";

/**
 * The prefix under which a response's original, unmodified headers ride along
 * beside the ones the browser is actually given.
 *
 * The two consumers of a proxied response disagree, and for around twenty
 * headers there is no single value that satisfies both. The browser must not
 * see the origin's real CSP, COOP or X-Frame-Options or the proxy cannot
 * function, and it must see `Location` and `Link` pointing at the proxy so it
 * resolves them correctly - while the page is entitled to read exactly what the
 * origin sent. So `rewriteResponseHeaders` copies every original under this
 * prefix before it strips and rewrites, and the client-side `Headers`,
 * `XMLHttpRequest` and cache views restore from those copies.
 *
 * Always go through {@link carriedHeaderName} and {@link uncarriedHeaderName}
 * rather than concatenating this. Header names come back lowercased from
 * `Headers` iteration and from `getAllResponseHeaders`, but are written with
 * the origin's own casing, so every comparison against the prefix has to be
 * case-insensitive - which is exactly the sort of thing that gets missed when
 * the literal is spelled out at each site.
 */
export const CARRIED_HEADER_PREFIX = "x-scramjet-";

/** The carrier name for an original header: `Link` -> `x-scramjet-Link`. */
export function carriedHeaderName(name: string): string {
	return CARRIED_HEADER_PREFIX + name;
}

/** Whether `name` is a carrier, and so must never be shown to the page. */
export function isCarriedHeaderName(name: string): boolean {
	return String_startsWith(String_toLowerCase(name), CARRIED_HEADER_PREFIX);
}

/**
 * The original header name a carrier stands for, or null when `name` is not a
 * carrier at all.
 */
export function uncarriedHeaderName(name: string): string | null {
	if (!isCarriedHeaderName(name)) return null;

	return String_substring(name, CARRIED_HEADER_PREFIX.length);
}

export class ScramjetHeaders {
	headers = {};

	set(key: string, v: string) {
		this.headers[key.toLowerCase()] = v;
	}

	append(key: string, v: string) {
		const lk = key.toLowerCase();
		this.headers[lk] = lk in this.headers ? `${this.headers[lk]}, ${v}` : v;
	}

	get(key: string): string | null {
		const lk = key.toLowerCase();
		if (lk in this.headers) {
			return this.headers[lk];
		}

		return null;
	}

	delete(key: string) {
		delete this.headers[key.toLowerCase()];
	}

	has(key: string): boolean {
		return key.toLowerCase() in this.headers;
	}

	toRawHeaders(): RawHeaders {
		const raw: RawHeaders = [];
		for (const k in this.headers) {
			raw.push([k, this.headers[k]]);
		}

		return raw;
	}

	toNativeHeaders(): Headers {
		const native = new Headers();
		for (const k in this.headers) {
			native.set(k, this.headers[k]);
		}

		return native;
	}

	static fromRawHeaders(raw: RawHeaders): ScramjetHeaders {
		const h = new ScramjetHeaders();
		for (const [k, v] of raw) {
			if (h.has(k)) {
				// console.debug(
				// 	`Duplicate header "${k}" found in raw headers, overwriting previous value.`
				// );
			}
			h.set(k, v);
		}

		return h;
	}

	static fromNativeHeaders(native: Headers): ScramjetHeaders {
		const h = new ScramjetHeaders();
		for (const [k, v] of native.entries()) {
			h.set(k, v);
		}

		return h;
	}

	clone(): ScramjetHeaders {
		const newh = new ScramjetHeaders();
		for (const k in this.headers) {
			newh.set(k, this.headers[k]);
		}

		return newh;
	}
}

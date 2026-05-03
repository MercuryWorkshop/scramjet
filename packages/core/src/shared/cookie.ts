// thnank you node unblocker guy
import { JSON_parse, JSON_stringify } from "@/shared/snapshot";
import { _Date } from "./snapshot";
import parse from "./set-cookie-parser";

export type Cookie = {
	name: string;
	value: string;
	path?: string;
	expires?: number;
	maxAge?: number;
	domain?: string;
	hostOnly?: boolean;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: string; // "strict"|"lax"|"none" or titlecase variants from parsers
};

export class CookieJar {
	private cookies: Record<string, Cookie> = {};
	// Index by domain (without leading dot)
	private byDomain: Map<string, Cookie[]> = new Map();
	private writeCount = 0;

	private defaultPath(url: URL): string {
		const pathname = url.pathname;
		if (!pathname || !pathname.startsWith("/")) return "/";
		const lastSlash = pathname.lastIndexOf("/");
		if (lastSlash <= 0) return "/";
		return pathname.slice(0, lastSlash);
	}

	private pathMatches(requestPath: string, cookiePath: string): boolean {
		if (requestPath === cookiePath) return true;
		if (!requestPath.startsWith(cookiePath)) return false;
		if (cookiePath.endsWith("/")) return true;
		return requestPath.charAt(cookiePath.length) === "/";
	}

	private indexCookie(c: Cookie) {
		const key = c.domain!.slice(1);
		let bucket = this.byDomain.get(key);
		if (!bucket) {
			bucket = [];
			this.byDomain.set(key, bucket);
		}
		bucket.push(c);
	}

	private unindexCookie(c: Cookie) {
		const key = c.domain!.slice(1);
		const bucket = this.byDomain.get(key);
		if (!bucket) return;
		const i = bucket.indexOf(c);
		if (i >= 0) bucket.splice(i, 1);
		if (bucket.length === 0) this.byDomain.delete(key);
	}

	private removeById(id: string) {
		const prev = this.cookies[id];
		if (prev) this.unindexCookie(prev);
		delete this.cookies[id];
	}

	private sweepExpired() {
		const now = _Date.now();
		const ids = Object.keys(this.cookies);
		for (let i = 0; i < ids.length; i++) {
			const id = ids[i];
			const c = this.cookies[id];
			if (c.expires !== undefined && c.expires < now) {
				this.unindexCookie(c);
				delete this.cookies[id];
			}
		}
	}

	setCookies(cookieString: string, url: URL) {
		const parsedCookies = parse(cookieString);

		for (const parsedCookie of parsedCookies) {
			const hostOnly = !parsedCookie.domain;
			const expires = parsedCookie.expires?.getTime();
			const cookie: Cookie = {
				...parsedCookie,
				hostOnly,
				expires,
			};

			if (!cookie.domain) cookie.domain = url.hostname;
			if (!cookie.domain.startsWith(".")) cookie.domain = "." + cookie.domain;
			if (!cookie.path || !cookie.path.startsWith("/")) {
				cookie.path = this.defaultPath(url);
			}
			if (!cookie.sameSite) cookie.sameSite = "lax";

			const id = `${cookie.domain}@${cookie.path}@${cookie.name}`;

			if (typeof cookie.maxAge === "number") {
				if (!Number.isFinite(cookie.maxAge)) {
					delete cookie.maxAge;
				} else if (cookie.maxAge <= 0) {
					this.removeById(id);
					continue;
				} else {
					cookie.expires = _Date.now() + cookie.maxAge * 1000;
				}
			}

			const prev = this.cookies[id];
			if (prev) this.unindexCookie(prev);
			this.cookies[id] = cookie;
			this.indexCookie(cookie);
		}

		this.writeCount += parsedCookies.length;
		if (this.writeCount >= 100) {
			this.sweepExpired();
			this.writeCount = 0;
		}
	}

	// SameSite enforcement context passed to getCookies.
	// "strict"     – same-site request; all cookies allowed
	// "lax"        – cross-site top-level GET/HEAD navigation; Strict blocked, Lax+None allowed
	// "cross-site" – cross-site subresource or non-GET navigation; only None allowed
	getCookies(
		url: URL,
		fromJs: boolean,
		sameSiteContext: "strict" | "lax" | "cross-site" = "strict"
	): string {
		const now = _Date.now();
		const hostname = url.hostname;
		const pathname = url.pathname;
		const validCookies: Cookie[] = [];

		// Walk the hostname's domain suffix chain
		let key: string | undefined = hostname;
		while (key !== undefined) {
			const bucket = this.byDomain.get(key);
			if (bucket) {
				for (let i = 0; i < bucket.length; i++) {
					const cookie = bucket[i];

					if (cookie.expires !== undefined && cookie.expires < now) continue;

					if (cookie.hostOnly && key !== hostname) continue;

					// Scramjet proxies all origins as HTTPS (including those served over HTTP),
					// so we don't enforce the Secure attribute based on protocol here.
					// if (cookie.secure && url.protocol !== "https:") continue;
					if (cookie.httpOnly && fromJs) continue;
					if (!this.pathMatches(pathname, cookie.path!)) continue;

					// SameSite enforcement — compare case-insensitively since parsers may
					// return "Strict"/"Lax"/"None" (titlecase) or "strict"/"lax"/"none".
					const cs = (cookie.sameSite ?? "lax").toLowerCase();
					if (sameSiteContext === "cross-site") {
						// Only SameSite=None cookies are sent cross-site
						if (cs !== "none") continue;
					} else if (sameSiteContext === "lax") {
						// Lax top-level navigation: block Strict, allow Lax and None
						if (cs === "strict") continue;
					}
					// "strict" context: all cookies allowed (no filtering)

					validCookies.push(cookie);
				}
			}
			const dot = key.indexOf(".");
			key = dot === -1 ? undefined : key.slice(dot + 1);
		}

		let out = "";
		for (let i = 0; i < validCookies.length; i++) {
			const cookie = validCookies[i];
			if (i > 0) out += "; ";
			out += cookie.name ? `${cookie.name}=${cookie.value}` : cookie.value;
		}
		return out;
	}

	load(cookies: string | Record<string, Cookie>) {
		if (typeof cookies === "object") {
			console.error("??");
			return;
		}
		const parsed: Record<string, Cookie> = JSON_parse(cookies);
		this.cookies = {};
		this.byDomain.clear();
		const ids = Object.keys(parsed);
		for (let i = 0; i < ids.length; i++) {
			const id = ids[i];
			const c = parsed[id];
			if (typeof c.expires === "string") {
				const t = Date.parse(c.expires as unknown as string);
				c.expires = Number.isFinite(t) ? t : undefined;
			}
			this.cookies[id] = c;
			this.indexCookie(c);
		}
	}

	clear() {
		this.cookies = {};
		this.byDomain.clear();
	}

	dump(): string {
		return JSON_stringify(this.cookies);
	}
}

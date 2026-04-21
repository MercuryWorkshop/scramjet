// thnank you node unblocker guy
import { JSON_parse, JSON_stringify, Object_values } from "@/shared/snapshot";
import { _Date } from "./snapshot";
import parse from "./set-cookie-parser";

export type Cookie = {
	name: string;
	value: string;
	path?: string;
	expires?: string;
	maxAge?: number;
	domain?: string;
	hostOnly?: boolean;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: string; // "strict"|"lax"|"none" or titlecase variants from parsers
};

export class CookieJar {
	private cookies: Record<string, Cookie> = {};

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

	setCookies(cookieString: string, url: URL) {
		const parsedCookies = parse(cookieString);

		for (const parsedCookie of parsedCookies) {
			const hostOnly = !parsedCookie.domain;
			const domain = parsedCookie.domain;
			const sameSite = parsedCookie.sameSite;
			const cookie: Cookie = {
				domain,
				hostOnly,
				sameSite,
				...parsedCookie,
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
					delete this.cookies[id];
					continue;
				} else {
					cookie.expires = new Date(
						Date.now() + cookie.maxAge * 1000
					).toString();
				}
			}

			if (cookie.expires) cookie.expires = cookie.expires.toString();
			this.cookies[id] = cookie;
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
		const now = new _Date();
		const cookies = Object_values(this.cookies);

		const validCookies: Cookie[] = [];

		for (const cookie of cookies) {
			if (cookie.expires && new _Date(cookie.expires) < now) {
				delete this.cookies[`${cookie.domain}@${cookie.path}@${cookie.name}`];
				continue;
			}

			// Scramjet proxies all origins as HTTPS (including those served over HTTP),
			// so we don't enforce the Secure attribute based on protocol here.
			// if (cookie.secure && url.protocol !== "https:") continue;
			if (cookie.httpOnly && fromJs) continue;
			if (!this.pathMatches(url.pathname, cookie.path)) continue;

			if (cookie.hostOnly) {
				if (url.hostname !== cookie.domain.slice(1)) continue;
			} else if (cookie.domain.startsWith(".")) {
				if (!url.hostname.endsWith(cookie.domain.slice(1))) continue;
			}

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

		return validCookies
			.map((cookie) =>
				cookie.name ? `${cookie.name}=${cookie.value}` : cookie.value
			)
			.join("; ");
	}

	load(cookies: string | Record<string, Cookie>) {
		if (typeof cookies === "object") {
			console.error("??");
			return;
		}
		this.cookies = JSON_parse(cookies);
	}

	clear() {
		this.cookies = {};
	}

	dump(): string {
		return JSON_stringify(this.cookies);
	}
}

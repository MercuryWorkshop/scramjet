// thnank you node unblocker guy
import parse from "set-cookie-parser";

export type Cookie = {
	name: string;
	value: string;
	path?: string;
	expires?: string;
	maxAge?: number;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: "strict" | "lax" | "none";
};

export class CookieStore {
	private cookies: Record<string, Cookie> = {};

	setCookies(cookies: string[], url: URL) {
		for (const str of cookies) {
			const parsed = parse(str);
			const domain = parsed.domain;
			const sameSite = parsed.sameSite;
			const cookie: Cookie = {
				domain,
				sameSite,
				...parsed[0],
			};

			if (!cookie.domain) cookie.domain = "." + url.hostname;
			if (!cookie.domain.startsWith(".")) cookie.domain = "." + cookie.domain;
			if (!cookie.path) cookie.path = "/";
			if (!cookie.sameSite) cookie.sameSite = "lax";
			if (cookie.expires) cookie.expires = cookie.expires.toString();

			const id = `${cookie.domain}@${cookie.path}@${cookie.name}`;
			this.cookies[id] = cookie;
		}
	}

	getCookies(url: URL, fromJs: boolean): string {
		const now = new Date();
		const cookies = Object.values(this.cookies);

		const validCookies: Cookie[] = [];

		for (const cookie of cookies) {
			if (cookie.expires && new Date(cookie.expires) < now) {
				delete this.cookies[`${cookie.domain}@${cookie.path}@${cookie.name}`];
				continue;
			}

			if (cookie.secure && url.protocol !== "https:") continue;
			if (cookie.httpOnly && fromJs) continue;
			if (!url.pathname.startsWith(cookie.path)) continue;

			if (cookie.domain.startsWith(".")) {
				if (!url.hostname.endsWith(cookie.domain.slice(1))) continue;
			}

			validCookies.push(cookie);
		}

		return validCookies
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join("; ");
	}

	load(cookies: string) {
		if (typeof cookies === "object") return cookies;
		this.cookies = JSON.parse(cookies);
	}

	dump(): string {
		return JSON.stringify(this.cookies);
	}
}

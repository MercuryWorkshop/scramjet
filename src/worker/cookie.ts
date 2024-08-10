export type Cookie = {
	name: string;
	value: string;
	path?: string;
	expires?: Date;
	maxAge?: number;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: "strict" | "lax" | "none";
};

class CookieStore {
	private cookies: Cookie[] = [];

	async load() {
		return this.cookies;
	}
}

export const cookieStore = new CookieStore();

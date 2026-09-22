import type { Cookie } from "@/shared";
import { Arguments, Returns, idlUSVString } from "@client/webidl";
import { parse as parseSetCookie } from "@/shared/set-cookie-parser";

import {
	_Date,
	_URL,
	Math_trunc,
	String_charCodeAt,
	String_indexOf,
	String_startsWith,
	String_substring,
	String_toLowerCase,
	TypeError,
} from "@/shared/snapshot";
import { ScramjetClient } from "@client/client";
import {
	readCookieInit,
	readCookieStoreDeleteOptions,
	readCookieStoreGetOptions,
} from "@client/helpers";

export const enabled = (_client: ScramjetClient, self: Self) =>
	"CookieStore" in self;
export default function (client: ScramjetClient, _self: Self) {
	/**
	 * A stored cookie as the Cookie Store API reports it.
	 *
	 * The jar keeps every domain dot-prefixed and tracks host-only separately;
	 * this API says a host-only cookie has a null domain and a domain cookie
	 * reports the bare domain.
	 */
	const toCookieListItem = (cookie: Cookie): CookieListItem => {
		const sameSite = String_toLowerCase(cookie.sameSite ?? "lax");

		return {
			name: cookie.name,
			value: cookie.value,
			domain: cookie.hostOnly ? null : String_substring(cookie.domain!, 1),
			path: cookie.path!,
			expires: cookie.expires ?? null,
			secure: !!cookie.secure,
			// the jar tolerates whatever a Set-Cookie header spelled; this API is
			// an enum, and its own default matches the jar's
			sameSite: sameSite === "strict" || sameSite === "none" ? sameSite : "lax",
			// reported as stored, which is all it is. the jar has no partition key,
			// so this isolates nothing: a partitioned and an unpartitioned cookie
			// with the same name, domain and path are one record, and a `delete`
			// with `partitioned: true` removes the unpartitioned one
			partitioned: !!cookie.partitioned,
		};
	};

	/**
	 * https://cookiestore.spec.whatwg.org/#query-cookies
	 *
	 * `url` is only ever the current document's URL in a window — the spec
	 * reserves a different in-scope URL for service workers — so once it has
	 * been validated there is nothing left for it to select.
	 */
	const query = (name?: string, url?: string): CookieListItem[] => {
		if (url !== undefined) {
			const parsed = new _URL(url, client.url);
			// compared without the fragment, which is not part of a cookie's
			// scope and which the document's own URL may or may not carry
			parsed.hash = "";
			const current = new _URL(client.url.href);
			current.hash = "";

			if (parsed.href !== current.href) {
				throw new TypeError(
					"Cookies can only be read for the current document's URL."
				);
			}
		}

		const cookies = client.context.cookieJar.getCookieList(client.url, true);
		const items: CookieListItem[] = [];

		for (let i = 0; i < cookies.length; i++) {
			if (name !== undefined && cookies[i].name !== name) continue;
			items[items.length] = toCookieListItem(cookies[i]);
		}

		return items;
	};

	/**
	 * WebIDL overload resolution between a `(USVString)` and a `(dictionary)`
	 * overload of the same arity: an object — a function counts — picks the
	 * dictionary, and so do null and undefined, because step 12 sends both to
	 * a dictionary-typed entry when there is one. Everything else, a number
	 * included, is converted as a string.
	 * https://webidl.spec.whatwg.org/#es-overloads
	 */
	const isDictionaryArgument = (value: unknown): boolean =>
		value === undefined ||
		value === null ||
		typeof value === "object" ||
		typeof value === "function";

	/**
	 * The `(CookieStoreGetOptions)` overload of `get` and `getAll`.
	 *
	 * https://cookiestore.spec.whatwg.org/#dom-cookiestore-get-options step 5
	 * makes an empty dictionary a TypeError — `get()` and `get({})` both reject.
	 * `getAll` has no such step, because `getAll()` is the documented way to ask
	 * for every cookie, so the rejection is the caller's to opt into. An empty
	 * *string* name is a member that is present, and does not trip it.
	 */
	const queryOptions = (
		value: unknown,
		rejectEmpty: boolean
	): CookieListItem[] => {
		const { name, url } = readCookieStoreGetOptions(value);

		if (rejectEmpty && name === undefined && url === undefined) {
			throw new TypeError("CookieStoreGetOptions must not be empty.");
		}

		return query(name, url);
	};

	/**
	 * The converted members of a write, whichever of the four call shapes
	 * produced it. `CookieInit` is the widest of them, so the reader's own
	 * output type is the shape — declaring it again by hand is a second copy of
	 * the member list to keep in step with {@link readCookieInit}.
	 */
	type WriteInit = ReturnType<typeof readCookieInit>;

	/**
	 * https://cookiestore.spec.whatwg.org/#set-a-cookie
	 *
	 * The Set-Cookie text for a write, or null when the write is invalid.
	 *
	 * Null means "hand this to the native store", not "throw". Every rejection
	 * that returns null is one the browser makes too, so the page gets the
	 * browser's own message instead of our approximation of it, which is the
	 * same bargain `compileIDLValidator` strikes for arguments. The two
	 * rejections that throw instead are marked where they sit: for those,
	 * delegating would have the native write for real.
	 *
	 * The native cannot write as a side effect of a delegated call. Every write
	 * handed over is one the browser rejects on its own terms — a ';' or '=' in
	 * the name, a dotted domain, a path with no leading slash, a __Host-
	 * violation, a pair the parser would not take — none of which depend on
	 * which origin is asking. What it receives is the {@link WriteInit} we built
	 * out of already-converted values, never the page's own object, whose
	 * getters have run once and must not run a second time.
	 *
	 * Writes are serialized rather than applied structurally so they go through
	 * the identical path as the `document.cookie` setter — one jar, mutually
	 * visible, one sync message. The jar's own parser is the authority on what
	 * that path accepts, so it does the pair-level checking; anything it drops
	 * would be a write that silently vanished.
	 */
	const serialize = (init: WriteInit): string | null => {
		const { name, value } = init;

		// these three have to come first, because they are the ones the parser
		// would not catch: a ';' reads back as an attribute boundary and an '='
		// as a name/value split, so the text would round-trip to a *different*
		// cookie rather than to nothing
		if (String_indexOf(name, ";") !== -1) return null;
		if (String_indexOf(name, "=") !== -1) return null;
		if (String_indexOf(value, ";") !== -1) return null;
		if (name === "" && String_indexOf(value, "=") !== -1) return null;

		let domain = init.domain;
		if (domain !== null) {
			domain = String_toLowerCase(domain);
			// the leading dot is a Set-Cookie spelling, not a value this API takes
			if (String_startsWith(domain, ".")) return null;

			// the one rejection that cannot be delegated. every other check here
			// is about the cookie alone, so the native reaches the same verdict —
			// but this one is about the *host*, and the native would compare
			// against the proxy's rather than the site's. handing it over could
			// mean a domain that happens to match the proxy, which the native
			// would accept and write for real
			//
			// `client.url`, because that is the URL `commit` keys the jar write on:
			// a check against any other host would authorize a cookie that then
			// lands somewhere else. in particular not `scopeUrl`, which is built
			// from `scopeOrigin` — an opaque document's is a per-client random
			// `about-opaque://` stand-in with no real host, and its docblock says
			// outright never to compare against it. a document with no host at all,
			// an `about:blank` frame, then rejects every `domain` here, which is
			// the right answer: its jar bucket is keyed on the empty hostname too,
			// so a domain cookie it wrote is one it could never read back
			const host = String_toLowerCase(client.url.hostname);
			const suffix = String_substring(host, host.length - domain.length - 1);
			if (domain !== host && suffix !== `.${domain}`) {
				throw new TypeError(
					"Cookie domain must domain-match the current host."
				);
			}
		}

		let path = init.path;
		if (!String_startsWith(path, "/")) return null;
		// the second rejection that cannot be delegated, and for the opposite
		// reason to the domain one: the spec does not reject a ';' in `path` at
		// all, so the native would accept it and set it structurally, where we
		// build header text. `path: "/x;Domain=victim.com;Path=/"` reads back out
		// of the jar's parser as a *different* cookie scoped to another site's
		// host, and handing it to the native instead would write a real cookie on
		// the proxy origin — the same leak from the other end
		if (hasHeaderMetacharacter(path)) {
			throw new TypeError(
				"Cookie path must not contain ';' or a control character."
			);
		}
		// the spec appends the slash, so `path: "/foo"` scopes to "/foo/" and
		// does not match "/foo" itself
		if (path[path.length - 1] !== "/") path += "/";

		// __Host- additionally requires Secure, which every write here is
		if (String_startsWith(String_toLowerCase(name), "__host-")) {
			if (domain !== null || path !== "/") return null;
		}

		let cookie = `${name}=${value}`;
		if (domain !== null) cookie += `; Domain=${domain}`;
		cookie += `; Path=${path}`;
		if (init.expires !== null) cookie += `; Max-Age=${toMaxAge(init.expires)}`;
		// this API only ever writes secure cookies
		cookie += `; Secure; SameSite=${init.sameSite}`;
		if (init.partitioned) cookie += "; Partitioned";

		// control characters, an oversized pair, an empty pair. the parser drops
		// those silently, which is right for a header off the wire and wrong
		// here, so ask it before committing rather than restating its rules
		if (parseSetCookie(cookie).length === 0) return null;

		return cookie;
	};

	const commit = async (cookie: string): Promise<void> => {
		client.context.cookieJar.setCookies(cookie, client.url);
		// unlike the `document.cookie` setter this awaits the sync: the returned
		// promise is what a caller sequences a following fetch() behind, so it
		// has to mean the cookie will actually be on that request
		await client.init.sendSetCookie([{ url: client.url, cookie }]);
	};

	client.Intercept(class extends CookieStore {
		@Returns("Promise<CookieListItem?>")
		@Arguments("optional (USVString or CookieStoreGetOptions)")
		async get(
			nameOrOptions?: string | CookieStoreGetOptions
		): Promise<CookieListItem | null> {
			void new client.native.CookieStore(this).onchange;

			const items = isDictionaryArgument(nameOrOptions)
				? queryOptions(nameOrOptions, true)
				: query(idlUSVString(nameOrOptions));

			return items.length ? items[0] : null;
		}

		@Returns("Promise<CookieList>")
		@Arguments("optional (USVString or CookieStoreGetOptions)")
		async getAll(
			nameOrOptions?: string | CookieStoreGetOptions
		): Promise<CookieList> {
			void new client.native.CookieStore(this).onchange;

			return isDictionaryArgument(nameOrOptions)
				? queryOptions(nameOrOptions, false)
				: query(idlUSVString(nameOrOptions));
		}

		// `set` is the one member whose overloads differ in arity rather than
		// in type, so the argument *count* picks it — `set("a", undefined)` is
		// the two-argument form with the value "undefined", while `set("a")` is
		// the dictionary form and fails to convert.
		@Returns("Promise<undefined>")
		@Arguments("(USVString or CookieInit)", "optional USVString")
		async set(
			nameOrOptions: string | CookieInit,
			value?: string
		): Promise<void> {
			void new client.native.CookieStore(this).onchange;

			if (arguments.length > 1) {
				const init: WriteInit = {
					name: idlUSVString(nameOrOptions),
					value: idlUSVString(value),
					domain: null,
					path: "/",
					expires: null,
					sameSite: "strict",
					partitioned: false,
				};
				const cookie = serialize(init);

				return cookie === null ? super.set(init) : commit(cookie);
			}

			const {
				domain,
				expires,
				name,
				partitioned,
				path,
				sameSite,
				value: cookieValue,
			} = readCookieInit(nameOrOptions);

			const init: WriteInit = {
				name,
				value: cookieValue,
				domain,
				path,
				expires,
				sameSite,
				partitioned,
			};
			const cookie = serialize(init);

			return cookie === null ? super.set(init) : commit(cookie);
		}

		/** A delete is a write of an empty value that already expired. */
		@Returns("Promise<undefined>")
		@Arguments("(USVString or CookieStoreDeleteOptions)")
		async delete(
			nameOrOptions: string | CookieStoreDeleteOptions
		): Promise<void> {
			void new client.native.CookieStore(this).onchange;

			const expired = {
				value: "",
				// the epoch is unconditionally in the past, which is the jar's
				// signal to drop the record rather than store a dead one
				expires: 0,
				sameSite: "strict" as const,
			};

			if (!isDictionaryArgument(nameOrOptions)) {
				const init: WriteInit = {
					...expired,
					name: idlUSVString(nameOrOptions),
					domain: null,
					path: "/",
					partitioned: false,
				};
				const cookie = serialize(init);

				return cookie === null ? super.delete(init) : commit(cookie);
			}

			const { domain, name, partitioned, path } =
				readCookieStoreDeleteOptions(nameOrOptions);

			const init: WriteInit = {
				...expired,
				name,
				domain,
				path,
				partitioned,
			};
			const cookie = serialize(init);

			return cookie === null ? super.delete(init) : commit(cookie);
		}
	});
}

/**
 * A character an attribute value cannot carry into Set-Cookie text: ';' opens
 * the next attribute, and a control character is one the jar's parser drops
 * off the wire and one a real header could not carry at all. The parser
 * applies this rule to a cookie's name and value itself, but an attribute we
 * concatenate the text out of has to be checked before it goes in.
 */
function hasHeaderMetacharacter(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = String_charCodeAt(value, i);
		// ';', DEL, and C0 except TAB — the parser's own rule for a name/value
		if (code === 0x3b || code === 0x7f || (code <= 0x1f && code !== 0x09)) {
			return true;
		}
	}

	return false;
}

/**
 * An absolute expiry as a Max-Age. The jar is fed Set-Cookie text, and Max-Age
 * is the attribute that survives without a date format — a non-positive one is
 * already its signal to drop the cookie, which is what a past expiry means.
 */
function toMaxAge(expires: number): number {
	const seconds = (expires - _Date.now()) / 1000;
	if (seconds <= 0) return 0;

	// truncating a sub-second expiry to 0 would read as a deletion
	return seconds < 1 ? 1 : Math_trunc(seconds);
}

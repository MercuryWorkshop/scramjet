import { GlobalScope, ScramjetClient } from "@client/index";
import {
	Arguments,
	Constructor,
	idlDOMString,
	Returns,
	Type,
} from "@client/webidl";
import { carriedHeaderName, uncarriedHeaderName } from "@/shared/headers";
import {
	Object_create,
	Reflect_apply,
	Reflect_get,
	String_startsWith,
} from "@/shared/snapshot";

/** The init members a string-input `fetch()` / `new Request()` reads, sorted. */
const URL_INIT_MEMBERS = ["credentials", "headers", "mode"] as const;
/** The only one anything else has to look at. */
const HEADERS_INIT_MEMBER = ["headers"] as const;

/**
 * Capture the page's intended `init.mode` / `init.credentials` and forward
 * them to `rewriteUrl` so they get stamped onto the proxy URL as `sj$mode` /
 * `sj$cred`. The service-side handler reads those back when computing
 * Sec-Fetch-Mode / Sec-Fetch-Storage-Access, since `event.request.mode` and
 * `event.request.credentials` from the SW are derived against the rewritten
 * same-origin URL and don't reflect the page's actual intent.
 *
 * Takes the members as {@link readInit} read them, not the page's object.
 */
function rewriteUrlOptionsForFetch(members: Record<string, unknown>) {
	return {
		// `fetch()` and `new Request()` both default mode to "cors" per spec.
		mode: (members.mode as string | undefined) ?? "cors",
		credentials: members.credentials === "include" ? "include" : undefined,
	};
}

export default function (client: ScramjetClient, self: Self) {
	const nativeGlobal = new client.native.window(self);

	const toNativeHeaders = (headers: Headers) => {
		const nGlobal = new client.native.window(self);
		const nHeaders = new client.native.Headers(headers);
		const newHeaders = new nGlobal.Headers();
		for (const [key, value] of nHeaders.entries()) {
			const original = uncarriedHeaderName(key);
			if (original !== null) newHeaders.set(original, value);
		}
		return newHeaders;
	};

	/**
	 * A `HeadersInit` the native constructors can be handed safely.
	 *
	 * `new Headers(h)`, `new Request(u, {headers: h})` and
	 * `new Response(b, {headers: h})` all fill from `h` by walking its internal
	 * header list, not by calling the `entries()` we patched - so handing them a
	 * tagged Headers copies the `x-scramjet-` carriers straight through into a
	 * list nothing corrects afterwards. Substitute the corrected view.
	 */
	const restoreHeadersInit = (init: unknown): unknown =>
		client.box.taggedHeaders.has(init as Headers)
			? toNativeHeaders(init as Headers)
			: init;

	/**
	 * A `RequestInit` / `ResponseInit` with the members named by `keys` read
	 * exactly once, and a tagged `headers` swapped for the corrected view.
	 *
	 * The native converts the whole dictionary itself, so reading a member here
	 * and then handing the page's object on runs that member's getter twice.
	 * Nor can the object be copied: a member may be inherited, including off a
	 * platform object - `new Response(body, response)` reads `status` and
	 * `statusText` from `Response.prototype`, which an own-property copy drops,
	 * leaving a 200 OK.
	 *
	 * So the native is handed a view that answers the members read here from
	 * what they read as, and sends every other `[[Get]]` to the page's object
	 * with the page's object as the receiver, which is what keeps a platform
	 * getter's brand check passing. `mode` and `credentials` go through
	 * `ToString` here too, so the native converts a primitive and runs no page
	 * code a second time. What this cannot keep is WebIDL's lexicographic
	 * order: these members are read before the native reads the rest.
	 */
	const readInit = <T>(
		init: T,
		keys: readonly string[]
	): { init: T; members: Record<string, unknown> } => {
		const members: Record<string, unknown> = Object_create(null);

		// undefined and null are the empty dictionary and anything else that is
		// not an object is the native's TypeError to raise, so neither has a
		// member to read
		if (
			init === null ||
			(typeof init !== "object" && typeof init !== "function")
		) {
			return { init, members };
		}

		for (let i = 0; i < keys.length; i++) {
			members[keys[i]] = (init as Record<string, unknown>)[keys[i]];
		}

		if (members.mode !== undefined) members.mode = idlDOMString(members.mode);
		if (members.credentials !== undefined) {
			members.credentials = idlDOMString(members.credentials);
		}
		if (client.box.taggedHeaders.has(members.headers as Headers)) {
			members.headers = toNativeHeaders(members.headers as Headers);
		}

		const view = new Proxy(init as object, {
			get: (target, key) =>
				key in members
					? members[key as string]
					: Reflect_get(target, key, target),
		});

		return { init: view as T, members };
	};

	/**
	 * A Request whose URL is the site's rather than the proxy's, rebuilt against
	 * the proxy URL.
	 *
	 * Anything built through our own constructor is already rewritten, but not
	 * every Request comes from there: a `cache.keys()` entry is keyed by the real
	 * URL by design, and one handed over from another realm never passed through
	 * us at all. Fetching either as-is goes straight at the origin and fails.
	 */
	const rewriteRequestObject = async (request: Request): Promise<Request> => {
		const n = new client.native.Request(request);
		const url: string = n.url;

		if (String_startsWith(url, client.context.prefix.href)) return request;
		if (!String_startsWith(url, "http:") && !String_startsWith(url, "https:")) {
			return request;
		}
		// a disturbed body is the native's to refuse, with its own TypeError
		if (n.bodyUsed) return request;

		const init: RequestInit = {
			method: n.method,
			headers: n.headers,
			// "navigate" cannot be reconstructed through the constructor, and a
			// fetch() of one is not something a page can do anyway
			mode: n.mode === "navigate" ? undefined : n.mode,
			credentials: n.credentials,
			cache: n.cache,
			redirect: n.redirect,
			referrer: n.referrer,
			referrerPolicy: n.referrerPolicy,
			integrity: n.integrity,
			keepalive: n.keepalive,
			signal: n.signal,
		};
		// buffered rather than handed over as a stream: a stream body needs
		// `duplex: "half"`, which a keepalive request refuses outright and which
		// Firefox does not support at all
		if (n.body !== null) init.body = await n.blob();

		return new nativeGlobal.Request(
			client.rewriteUrl(url, {
				mode: n.mode === "navigate" ? "cors" : n.mode,
				credentials: n.credentials === "include" ? "include" : undefined,
			}),
			init
		);
	};

	client.Intercept(class extends GlobalScope {
		// RequestInfo is the Fetch typedef `(Request or USVString)`.
		// https://fetch.spec.whatwg.org/#requestinfo
		@Arguments("(Request or USVString)", "optional RequestInit")
		@Returns("Promise<Response>")
		static async fetch(input: RequestInfo, requestInit?: RequestInit) {
			const { init, members } = readInit(
				requestInit,
				typeof input === "string" ? URL_INIT_MEMBERS : HEADERS_INIT_MEMBER
			);
			input =
				typeof input === "string"
					? client.rewriteUrl(input, rewriteUrlOptionsForFetch(members))
					: await rewriteRequestObject(input);

			// through `this` rather than a saved global, so the native's own
			// receiver check still sees what the page called it on
			const response = await new client.native.window(this).fetch(input, init);
			client.box.taggedResponses.add(response);

			return response;
		}
	});

	client.Intercept(class extends Request {
		@Constructor("(Request or USVString)", "optional RequestInit")
		static konstructor(input: RequestInfo, requestInit?: RequestInit) {
			const { init, members } = readInit(
				requestInit,
				typeof input === "string" ? URL_INIT_MEMBERS : HEADERS_INIT_MEMBER
			);
			if (typeof input === "string") {
				input = client.rewriteUrl(input, rewriteUrlOptionsForFetch(members));
			}

			return new this(input, init);
		}

		@Type("USVString")
		get url() {
			const url = super.url;
			// in almost every case, the URL is already rewritten
			// the exception is the request coming off a cache.keys()
			// worth looking into tagging this instead of the string match/

			return String_startsWith(url, client.context.prefix.href)
				? client.unrewriteUrl(url)
				: url;
		}
	});
	client.Intercept(class extends Response {
		@Constructor("optional BodyInit?", "optional ResponseInit")
		static konstructor(body?: BodyInit | null, responseInit?: ResponseInit) {
			return new this(body, readInit(responseInit, HEADERS_INIT_MEMBER).init);
		}

		@Type("USVString")
		get url(): string {
			if (client.box.taggedResponses.has(this)) {
				return client.unrewriteUrl(super.url);
			}
			return super.url;
		}
		@Type("Headers")
		get headers(): Headers {
			const headers = super.headers;
			if (client.box.taggedResponses.has(this)) {
				// this is a response object that came from a network request. tag it so that the headers can be replaced later
				client.box.taggedHeaders.add(headers);
			}
			return headers;
		}

		// the clone is a separate Response object, and an untagged one reads
		// back the *proxy's* URL and the wire's stripped header list. the tag
		// has to travel with it
		@Returns("Response")
		@Arguments()
		clone(): Response {
			const cloned = super.clone();
			if (client.box.taggedResponses.has(this)) {
				client.box.taggedResponses.add(cloned);
			}

			return cloned;
		}
	});

	/**
	 * Make the native reject a name the carrier prefix would otherwise rescue.
	 *
	 * `carriedHeaderName("")` is `x-scramjet-`, which is a perfectly good header
	 * name, so prefixing first turns the TypeError Fetch owes the page for an
	 * invalid name into a silent `null`. Asking the native about the page's own
	 * string is the only way to get its verdict without restating the token
	 * grammar here; `has` performs the same validation as `get` and does
	 * nothing else.
	 */
	const validateHeaderName = (headers: Headers, name: string) => {
		new client.native.Headers(headers).has(name);
	};

	/* eslint-disable scramjet-core/intercept-brand-check --
	   `keys`, `values`, `entries` and `forEach` both reach the native: the
	   untagged path through `super`, and the tagged path inside
	   `toNativeHeaders`, which calls `new client.native.Headers(this).forEach`.
	   The rule does not follow the helper call, so it sees a return that skips
	   `super` and reports it. */
	client.Intercept(class extends Headers {
		@Constructor("optional HeadersInit")
		static konstructor(init?: HeadersInit) {
			return new this(restoreHeadersInit(init) as HeadersInit);
		}

		@Arguments("ByteString")
		@Returns("ByteString?")
		get(name: string): string | null {
			if (!client.box.taggedHeaders.has(this)) return super.get(name);

			validateHeaderName(this, name);

			return super.get(carriedHeaderName(name));
		}
		@Arguments("ByteString")
		@Returns("boolean")
		has(name: string): boolean {
			if (!client.box.taggedHeaders.has(this)) return super.has(name);

			validateHeaderName(this, name);

			return super.has(carriedHeaderName(name));
		}
		keys(): HeadersIterator<string> {
			if (client.box.taggedHeaders.has(this)) {
				return toNativeHeaders(this).keys();
			}
			return super.keys();
		}
		values(): HeadersIterator<string> {
			if (client.box.taggedHeaders.has(this)) {
				return toNativeHeaders(this).values();
			}
			return super.values();
		}
		entries(): HeadersIterator<[string, string]> {
			if (client.box.taggedHeaders.has(this)) {
				return toNativeHeaders(this).entries();
			}
			return super.entries();
		}
		forEach(callbackfn: any, thisArg?: any): void {
			// a non-callable is the native's TypeError to raise, before any pair
			if (
				!client.box.taggedHeaders.has(this) ||
				typeof callbackfn !== "function"
			) {
				return super.forEach(callbackfn, thisArg);
			}

			// the callback's third argument is the Headers being iterated, so it
			// has to be the page's object and not the corrected copy
			toNativeHeaders(this).forEach((value, key) => {
				Reflect_apply(callbackfn, thisArg, [value, key, this]);
			});
		}
	});
	self.Headers.prototype[self.Symbol.iterator] = self.Headers.prototype.entries;
}

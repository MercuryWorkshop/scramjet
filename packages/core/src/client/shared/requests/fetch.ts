import { GlobalScope, ScramjetClient } from "@client/index";
import {
	Arguments,
	Constructor,
	dictionaryReaderOf,
	idlConverter,
	type IDLMember,
	Returns,
	Type,
} from "@client/webidl";
import { carriedHeaderName, uncarriedHeaderName } from "@/shared/headers";
import { iswindow } from "@client/entry";
import type { NativeErrorSite } from "@client/nativeerror";
import {
	Array_isArray,
	Object_assign,
	Object_create,
	Reflect_apply,
	Reflect_get,
	String_startsWith,
	Symbol_iterator,
	_URL,
} from "@/shared/snapshot";

/**
 * Capture the page's intended `init.mode` / `init.credentials` and forward
 * them to `rewriteUrl` so they get stamped onto the proxy URL as `sj$mode` /
 * `sj$cred`. The service-side handler reads those back when computing
 * Sec-Fetch-Mode / Sec-Fetch-Storage-Access, since `event.request.mode` and
 * `event.request.credentials` from the SW are derived against the rewritten
 * same-origin URL and don't reflect the page's actual intent.
 *
 * Takes the init as {@link readRequestInit} converted it, not the page's.
 */
function rewriteUrlOptionsForFetch(init: Record<string, unknown>) {
	return {
		// `fetch()` and `new Request()` both default mode to "cors" per spec.
		mode: (init.mode as string | undefined) ?? "cors",
		credentials: init.credentials === "include" ? "include" : undefined,
	};
}

export default function (client: ScramjetClient, self: Self) {
	const nativeGlobal = new client.native.window(self);

	const toNativeHeaders = (headers: Headers) => {
		const nGlobal = new client.native.window(self);
		const newHeaders = new nGlobal.Headers();
		const nNew = new client.native.Headers(newHeaders);

		// `forEach`, which the native drives itself, rather than
		// `for (const [key, value] of nHeaders.entries())`. Reaching the
		// headers through `client.native` bought nothing there, because the
		// iteration never touched the native: the loop read @@iterator off the
		// iterator, which resolves to the page-replaceable `%IteratorPrototype%`,
		// and the destructuring read `Array.prototype[@@iterator]`. A page could
		// therefore choose what the restored view contained - and that view is
		// what `new Headers(init)`, `new Request(url, {headers})` and
		// `new Response(body, {headers})` are filled from
		new client.native.Headers(headers).forEach((value: string, key: string) => {
			const original = uncarriedHeaderName(key);
			if (original !== null) nNew.set(original, value);
		});

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
	 * A `RequestInit.referrer`, parsed, as the native constructor should see it.
	 *
	 * The native parses it against the proxy's URL and turns anything not
	 * same-origin with the proxy into `about:client`, so the site's URL has to
	 * be judged against the site's origin here and handed over as the proxy's.
	 * The service worker reads it back off the request.
	 *
	 * https://fetch.spec.whatwg.org/#dom-request (the `referrer` steps)
	 */
	const referrerFor = (parsed: URL): string => {
		if (parsed.protocol === "about:" && parsed.pathname === "client") {
			return "about:client";
		}
		// against the document's origin, which is opaque in a sandboxed frame
		// and so the same as no URL's
		if (parsed.origin !== client.originKey) return "about:client";

		return client.rewriteUrl(parsed.href);
	};

	/**
	 * A `ResponseInit` with `headers` read exactly once, and a tagged one
	 * swapped for the corrected view.
	 *
	 * The native converts the whole dictionary itself, so reading a member here
	 * and then handing the page's object on runs that member's getter twice.
	 * Nor can the object be copied: a member may be inherited, including off a
	 * platform object - `new Response(body, response)` reads `status` and
	 * `statusText` from `Response.prototype`, which an own-property copy drops,
	 * leaving a 200 OK.
	 *
	 * So the native is handed a view that answers `headers` from what it read
	 * as, and sends every other `[[Get]]` to the page's object with the page's
	 * object as the receiver, which is what keeps a platform getter's brand
	 * check passing. The view is not a proxy *of* the page's object: a frozen
	 * one's members could then only ever read as they are, and a proxy that
	 * answers otherwise throws. What this cannot keep is WebIDL's lexicographic
	 * order: `headers` is read before the native reads the rest.
	 */
	const readResponseInit = <T>(init: T): T => {
		// undefined and null are the empty dictionary and anything else that is
		// not an object is the native's TypeError to raise, so neither has a
		// member to read
		if (
			init === null ||
			(typeof init !== "object" && typeof init !== "function")
		) {
			return init;
		}

		let headers = (init as Record<string, unknown>).headers;
		if (client.box.taggedHeaders.has(headers as Headers)) {
			headers = toNativeHeaders(headers as Headers);
		}

		return new Proxy(Object_create(null), {
			get: (_, key) =>
				key === "headers" ? headers : Reflect_get(init as object, key, init),
		}) as T;
	};

	const convertHeadersInit = idlConverter(
		"(sequence<sequence<ByteString>> or record<ByteString, ByteString>)",
		"Failed to read the 'headers' property from 'RequestInit': The provided value is not of type '(record<ByteString, ByteString> or sequence<sequence<ByteString>>)'."
	);

	/**
	 * `items` as an iterable the native iterates without looking anything up
	 * on a prototype: its `@@iterator`, the iterator's `next` and every result
	 * are its own properties, where an array's are `Array.prototype`'s and
	 * `%ArrayIteratorPrototype%`'s, which are the page's to replace.
	 */
	const ownIterable = (items: unknown[]): object => {
		const iterable = Object_create(null);
		iterable[Symbol_iterator] = () => {
			let i = 0;
			const iterator = Object_create(null);
			iterator.next = () => {
				const result = Object_create(null);
				result.done = i >= items.length;
				result.value = result.done ? undefined : items[i++];

				return result;
			};

			return iterator;
		};

		return iterable;
	};

	/**
	 * A `HeadersInit`, in a form the native reads without running anything of
	 * the page's: entries in a sequence of {@link ownIterable}s - a Headers
	 * read through the native, a tagged one as its corrected view - or a
	 * record with no prototype, for the native to fill the request from entry
	 * by entry, under its own guard and with its own errors.
	 */
	const convertHeaders = (value: unknown): unknown => {
		// read now and through the native, where the native would fill the
		// request from it now: a later member's getter can still change it, or
		// the `@@iterator` it would be read with
		const headers = client.box.taggedHeaders.has(value as Headers)
			? toNativeHeaders(value as Headers)
			: client.box.instanceof(value, "Headers")
				? (value as Headers)
				: null;
		if (headers) {
			const pairs: object[] = [];
			new client.native.Headers(headers).forEach((v: string, k: string) => {
				pairs[pairs.length] = ownIterable([k, v]);
			});

			return ownIterable(pairs);
		}

		const converted = convertHeadersInit(value) as
			| string[][]
			| Record<string, string>;
		if (Array_isArray(converted)) {
			const pairs: object[] = [];
			for (let i = 0; i < converted.length; i++) {
				pairs[i] = ownIterable(converted[i]);
			}

			return ownIterable(pairs);
		}

		return converted;
	};

	/**
	 * `RequestInit`, member by member: the members Chrome converts, its
	 * partials included. `privateToken` is a dictionary of its own that is
	 * handed on as it is, for the native to convert.
	 * https://fetch.spec.whatwg.org/#requestinit
	 *
	 * `targetAddressSpace` is an enum whose values are the native's to know.
	 * It is only converted to a string here - and being the last member read,
	 * its value is checked where it would be, with nothing left to read after.
	 */
	const REQUEST_INIT: Record<string, IDLMember> = Object_assign(
		Object_create(null),
		{
			adAuctionHeaders: "boolean",
			attributionReporting: dictionaryReaderOf(
				"AttributionReportingRequestOptions",
				{
					eventSourceEligible: "required boolean",
					triggerEligible: "required boolean",
				},
				client.box
			),
			// Chrome's is `any`, converted by the constructor steps rather
			// than here: a string's `toString` runs after every member is read
			body: "any",
			browsingTopics: "boolean",
			cache: "RequestCache",
			credentials: "RequestCredentials",
			duplex: "RequestDuplex",
			headers: convertHeaders,
			integrity: "DOMString",
			keepalive: "boolean",
			method: "ByteString",
			mode: "RequestMode",
			priority: "RequestPriority",
			privateToken: "any",
			redirect: "RequestRedirect",
			referrer: "USVString",
			referrerPolicy: "ReferrerPolicy",
			sharedStorageWritable: "boolean",
			signal: "AbortSignal?",
			targetAddressSpace: "DOMString",
		}
	);

	const requestInitReader = dictionaryReaderOf(
		"RequestInit",
		REQUEST_INIT,
		client.box
	);
	const readRequestInit = (
		value: unknown,
		site: NativeErrorSite
	): Record<string, unknown> => {
		const init = requestInitReader(value);
		// resolved once the whole dictionary has been converted, as the
		// constructor steps do: a later member can still have moved <base>
		if (typeof init.referrer === "string" && init.referrer !== "") {
			let parsed: URL;
			try {
				parsed = new _URL(init.referrer, client.meta.base);
			} catch {
				throw client.errors.typeError({
					...site,
					detail: `Referrer '${init.referrer}' is not a valid URL.`,
				});
			}
			init.referrer = referrerFor(parsed);
		}

		return init;
	};

	/**
	 * The proxy URL a Request whose URL is the site's rather than the proxy's
	 * has to be rebuilt at, or null for one that is fine as it is.
	 *
	 * Anything built through our own constructor is already rewritten, but not
	 * every Request comes from there: a `cache.keys()` entry is keyed by the real
	 * URL by design, and one handed over from another realm never passed through
	 * us at all. Fetching either as-is goes straight at the origin and fails.
	 */
	const proxyUrlFor = (n: Request): string | null => {
		const url: string = n.url;

		if (String_startsWith(url, client.context.prefix.href)) return null;
		if (!String_startsWith(url, "http:") && !String_startsWith(url, "https:")) {
			return null;
		}
		// a disturbed body is the native's to refuse, with its own TypeError
		if (n.bodyUsed) return null;

		return client.rewriteUrl(url, {
			mode: n.mode === "navigate" ? "cors" : n.mode,
			credentials: n.credentials === "include" ? "include" : undefined,
		});
	};

	/**
	 * `request` - read through the native, as `n` - at another URL.
	 *
	 * Or `request` itself when its signal has already been aborted and the
	 * init leaves it in place, for the native to reject with the reason before
	 * reading any of the body - which an open stream would otherwise never
	 * finish giving up.
	 */
	const copyRequest = async (
		request: Request,
		n: Request,
		url: string,
		signalReplaced: boolean
	): Promise<Request> => {
		if (!signalReplaced && new client.native.AbortSignal(n.signal).aborted) {
			return request;
		}

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

		return new nativeGlobal.Request(url, init);
	};

	/**
	 * Whether the browser would have refused this fetch for carrying integrity
	 * metadata into a response it cannot read.
	 *
	 * A `no-cors` fetch of another origin gets an opaque response, and one with
	 * a digest to check is a network error - no digest is ever checked against
	 * an opaque body. Proxied, every fetch is same-origin and nothing is
	 * opaque, so the browser lets it through; the refusal has to be made here.
	 * It needs no digest: it is the mode, the origin and whether there is
	 * integrity metadata at all. A same-origin fetch that is redirected to
	 * another origin is not caught.
	 *
	 * `request` is what the native was handed, and `init` the init as
	 * {@link readRequestInit} converted it.
	 *
	 * https://fetch.spec.whatwg.org/#main-fetch
	 */
	const isOpaqueWithIntegrity = (
		request: RequestInfo,
		init: Record<string, unknown>
	): boolean => {
		let mode = init.mode as string | undefined;
		let integrity = init.integrity as string | undefined;
		let url: string;
		if (typeof request === "string") {
			url = request;
			mode ??= "cors";
		} else {
			const n = new client.native.Request(request);
			url = n.url;
			mode ??= n.mode;
			integrity ??= n.integrity;
		}

		if (mode !== "no-cors" || !integrity) return false;

		const target = new _URL(client.unrewriteUrl(url));
		if (target.protocol !== "http:" && target.protocol !== "https:") {
			return false;
		}

		return target.origin !== client.url.origin;
	};

	client.Intercept(class extends GlobalScope {
		// RequestInfo is the Fetch typedef `(Request or USVString)`.
		// https://fetch.spec.whatwg.org/#requestinfo
		@Arguments("(Request or USVString)", "optional RequestInit")
		@Returns("Promise<Response>")
		static async fetch(input: RequestInfo, requestInit?: RequestInit) {
			const init = readRequestInit(requestInit, {
				execute: "fetch",
				on: iswindow ? "Window" : "WorkerGlobalScope",
			});
			// through `this` rather than a saved global, so the native's own
			// receiver check still sees what the page called it on
			const nativeThis = new client.native.window(this);

			let request: RequestInfo;
			if (typeof input === "string") {
				request = client.rewriteUrl(input, rewriteUrlOptionsForFetch(init));
			} else {
				const n = new client.native.Request(input);
				const url = proxyUrlFor(n);
				request =
					url === null
						? input
						: await copyRequest(input, n, url, init.signal !== undefined);
			}

			const response: Response = await nativeThis.fetch(request, init);

			if (isOpaqueWithIntegrity(request, init)) {
				throw client.errors.typeError({ detail: "Failed to fetch" });
			}
			client.box.taggedResponses.add(response);

			return response;
		}
	});

	client.Intercept(class extends Request {
		@Constructor("(Request or USVString)", "optional RequestInit")
		static konstructor(input: RequestInfo, requestInit?: RequestInit) {
			const init = readRequestInit(requestInit, { construct: "Request" });
			if (typeof input === "string") {
				input = client.rewriteUrl(input, rewriteUrlOptionsForFetch(init));
			}

			// converted already, so the native reads nothing of the page's
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

		// the referrer init was handed to the native as a proxy URL, and one
		// that is not (`about:client`, or none) is the same for the site
		@Type("USVString")
		get referrer() {
			const referrer = super.referrer;

			return String_startsWith(referrer, client.context.prefix.href)
				? client.unrewriteUrl(referrer)
				: referrer;
		}
	});
	client.Intercept(class extends Response {
		@Constructor("optional BodyInit?", "optional ResponseInit")
		static konstructor(body?: BodyInit | null, responseInit?: ResponseInit) {
			return new this(body, readResponseInit(responseInit));
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

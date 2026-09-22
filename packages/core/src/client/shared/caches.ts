import { ScramjetClient } from "@client/index";
import { Arguments, Returns } from "@client/webidl";
import {
	Promise_all,
	String_split,
	String_startsWith,
	String_substring,
	String_trim,
	_Set,
	_URL,
} from "@/shared/snapshot";

export const enabled = (_client: ScramjetClient, self: Self) =>
	"caches" in self && "Cache" in self && "CacheStorage" in self;

export default function (client: ScramjetClient, self: Self) {
	const nGlobal = new client.native.window(self);
	const scopePrefix = () => `${client.scopeOrigin}@`;
	const scopedName = (name: string) => scopePrefix() + name;
	const rewriteRequest = (request: RequestInfo): RequestInfo =>
		typeof request === "string"
			? client.rewriteUrl(request, { mode: "cors" })
			: request;

	/** The request's method, without going near a page-visible accessor. */
	const methodOf = (request: RequestInfo): string =>
		typeof request === "string"
			? "GET"
			: new client.native.Request(request).method;

	/**
	 * Whether a response's `Vary` names `*`, which makes it uncacheable.
	 *
	 * `Vary` is neither stripped nor rewritten on the way through, so the value
	 * on the wire is the origin's own and there is no carried copy to prefer.
	 */
	const variesOnEverything = (response: Response): boolean => {
		const vary = new client.native.Headers(
			new client.native.Response(response).headers
		).get("vary") as string | null;
		if (vary === null) return false;

		const parts = String_split(vary, ",");
		for (let i = 0; i < parts.length; i++) {
			if (String_trim(parts[i]) === "*") return true;
		}

		return false;
	};

	const realUrl = (request: RequestInfo): string =>
		typeof request === "string"
			? new _URL(request, client.url).href
			: client.unrewriteUrl(new client.native.Request(request).url);

	/**
	 * The key as something the native cache will accept.
	 *
	 * A Request has to stay a Request. The method is what `ignoreMethod`
	 * compares and what `put` rejects a non-GET on, and the headers are what
	 * `Vary` matches against — flattening it to a URL string throws both away.
	 * Mode, credentials and destination are dropped on purpose: none of them are
	 * part of a cache key, and all of them differ between two ways of asking for
	 * the same resource.
	 */
	const cacheKey = (request: RequestInfo): RequestInfo => {
		if (typeof request === "string") return realUrl(request);

		const nRequest = new client.native.Request(request);

		return new nGlobal.Request(realUrl(request), {
			method: nRequest.method,
			headers: nRequest.headers,
		});
	};

	/**
	 * Mark a Response as having come off the network.
	 *
	 * `shared/requests/fetch.ts` gates `Response.url`, `Response.headers` and
	 * `clone()`'s tag propagation on this: a tagged Response unrewrites its URL
	 * and gets its stripped headers put back, an untagged one reads the wire's
	 * own. A cache entry is a fresh Response object every `match()`, so the tag
	 * cannot ride along from the `fetch()` that produced it and has to be
	 * reapplied here.
	 *
	 * `Response.url` is the proof, because a page cannot forge it: an entry the
	 * page built with `new Response()` has an empty url and stays untagged.
	 */
	const tag = <T>(response: T): T => {
		if (!response) return response;

		const networkProvenance = String_startsWith(
			new client.native.Response(response).url,
			client.context.prefix.href
		);
		if (networkProvenance) {
			client.box.taggedResponses.add(response as Response);
		}

		return response;
	};

	/**
	 * A stored key as the page is allowed to see it.
	 *
	 * The cache stores keys under the site's own URL, which is the whole point
	 * of `cacheKey` - but handing those Requests back to the page is a way out
	 * of the proxy, because `fetch(key)` short-circuits on a Request and would
	 * go straight to the origin. Rebuilt on the rewritten URL instead: the
	 * `url` getter unrewrites it back to the site's, and a re-fetch is proxied.
	 */
	const pageKey = (request: Request): Request => {
		const nRequest = new client.native.Request(request);

		return new nGlobal.Request(
			client.rewriteUrl(nRequest.url, { mode: "cors" }),
			{ method: nRequest.method, headers: nRequest.headers }
		);
	};

	/**
	 * https://w3c.github.io/ServiceWorker/#cache-addall, which `add` is defined
	 * as the one-element case of.
	 *
	 * Not delegable to the native: it would fetch whichever URL it was keyed
	 * with, and the key is the *site's*, which does not go through the proxy. So
	 * the fetch and every check that gates it happen here, in the spec's order —
	 * scheme, then every response, then the batch itself.
	 *
	 * `put` is passed in because `super` only resolves inside a class method.
	 */
	const runAddAll = async (
		requests: RequestInfo[],
		method: "add" | "addAll",
		put: (key: RequestInfo, response: Response) => Promise<void>
	): Promise<void> => {
		for (let i = 0; i < requests.length; i++) {
			const url = realUrl(requests[i]);
			if (
				!String_startsWith(url, "http:") &&
				!String_startsWith(url, "https:")
			) {
				throw client.errors.typeError({
					execute: method,
					on: "Cache",
					detail: "Request scheme must be http or https",
				});
			}

			// a cache key is always a GET, and the spec refuses the batch here
			// rather than letting `put` reject it one entry in
			if (methodOf(requests[i]) !== "GET") {
				throw client.errors.typeError({
					execute: method,
					on: "Cache",
					detail: "Request method must be GET",
				});
			}
		}

		// every fetch has to land before anything is written, so a failure part
		// way through cannot leave half a batch behind.
		//
		// built with an indexed loop rather than `requests.map`:
		// `Array.prototype.map` is page-writable, so a page could otherwise
		// choose which URLs this actually fetches
		const fetches: Promise<Response>[] = [];
		for (let i = 0; i < requests.length; i++) {
			fetches[i] = nGlobal.fetch(rewriteRequest(requests[i]));
		}
		const responses = await Promise_all(fetches);

		for (let i = 0; i < responses.length; i++) {
			const status = new client.native.Response(responses[i]).status;

			// `status` through the native rather than `ok`, which is a
			// page-replaceable accessor on `Response.prototype`. 206 is inside
			// the ok range either way, so `ok` alone let a partial response
			// through - and a cache entry holding one answers a later full
			// request with half a body
			if (status < 200 || status > 299 || status === 206) {
				throw client.errors.typeError({
					execute: method,
					on: "Cache",
					detail: "Request failed",
				});
			}

			if (variesOnEverything(responses[i])) {
				throw client.errors.typeError({
					execute: method,
					on: "Cache",
					detail: "Vary header contains *",
				});
			}
		}

		const seen = new _Set<string>();
		for (let i = 0; i < requests.length; i++) {
			const url = realUrl(requests[i]);
			if (seen.has(url)) {
				throw client.errors.domException("InvalidStateError", {
					execute: method,
					on: "Cache",
					detail: `duplicate requests (${url}).`,
				});
			}
			seen.add(url);
		}

		const writes: Promise<void>[] = [];
		for (let i = 0; i < requests.length; i++) {
			writes[i] = put(cacheKey(requests[i]), responses[i]);
		}
		await Promise_all(writes);
	};

	// `add` and `addAll` are the two members that never reach the native on
	// their own: every check they make is about the request, and the writes go
	// through a `put` closure that an empty list never calls. So
	// `Cache.prototype.addAll.call({}, [])` resolved where a browser rejects,
	// and a non-empty list fetched on the caller's behalf before the receiver
	// was ever questioned. Both open with a lookup that cannot match, the
	// cheapest member that brand-checks - inline rather than through a helper,
	// because `scramjet-core/intercept-brand-check` only recognises a literal
	// `this`.
	client.Intercept(class extends Cache {
		@Returns("Promise<(Response or undefined)>")
		@Arguments("(Request or USVString)", "optional CacheQueryOptions")
		async match(
			request: RequestInfo,
			options: CacheQueryOptions = {}
		): Promise<Response | undefined> {
			return tag(await super.match(cacheKey(request), options));
		}

		@Returns("Promise<sequence<Response>>")
		@Arguments("optional (Request or USVString)", "optional CacheQueryOptions")
		async matchAll(
			request?: RequestInfo,
			options: CacheQueryOptions = {}
		): Promise<readonly Response[]> {
			const matches = await super.matchAll(
				request === undefined ? undefined : cacheKey(request),
				options
			);
			for (const match of matches) tag(match);

			return matches;
		}

		@Returns("Promise<undefined>")
		@Arguments("(Request or USVString)")
		async add(request: RequestInfo): Promise<void> {
			await new client.native.Cache(this).match("about:blank");

			return runAddAll([request], "add", (key, response) =>
				super.put(key, response)
			);
		}

		@Returns("Promise<undefined>")
		@Arguments("sequence<(Request or USVString)>")
		async addAll(requests: RequestInfo[]): Promise<void> {
			await new client.native.Cache(this).match("about:blank");

			return runAddAll(requests, "addAll", (key, response) =>
				super.put(key, response)
			);
		}

		@Returns("Promise<undefined>")
		@Arguments("(Request or USVString)", "Response")
		put(request: RequestInfo, response: Response): Promise<void> {
			return super.put(cacheKey(request), response);
		}

		@Returns("Promise<boolean>")
		@Arguments("(Request or USVString)", "optional CacheQueryOptions")
		delete(
			request: RequestInfo,
			options: CacheQueryOptions = {}
		): Promise<boolean> {
			return super.delete(cacheKey(request), options);
		}

		@Returns("Promise<sequence<Request>>")
		@Arguments("optional (Request or USVString)", "optional CacheQueryOptions")
		async keys(
			request?: RequestInfo,
			options: CacheQueryOptions = {}
		): Promise<readonly Request[]> {
			const stored = await (request === undefined
				? super.keys(undefined, options)
				: super.keys(cacheKey(request), options));
			const visible: Request[] = [];

			for (let i = 0; i < stored.length; i++) {
				visible[visible.length] = pageKey(stored[i]);
			}

			return visible;
		}
	});

	client.Intercept(class extends CacheStorage {
		@Returns("Promise<Cache>")
		@Arguments("DOMString")
		open(cacheName: string): Promise<Cache> {
			return super.open(scopedName(cacheName));
		}

		@Returns("Promise<boolean>")
		@Arguments("DOMString")
		has(cacheName: string): Promise<boolean> {
			return super.has(scopedName(cacheName));
		}

		@Returns("Promise<(Response or undefined)>")
		@Arguments("(Request or USVString)", "optional MultiCacheQueryOptions")
		async match(
			request: RequestInfo,
			options: MultiCacheQueryOptions = {}
		): Promise<Response | undefined> {
			// https://webidl.spec.whatwg.org/#es-dictionary - a dictionary
			// converts from undefined, null or an Object and throws for
			// anything else. This member reads the options itself rather than
			// handing them to the native, so the rejection is owed here too:
			// without it `caches.match(req, 5)` resolved undefined whenever
			// this origin happened to have no caches to walk
			if (
				options !== undefined &&
				options !== null &&
				typeof options !== "object" &&
				typeof options !== "function"
			) {
				throw client.errors.typeError({
					execute: "match",
					on: "CacheStorage",
					// verbatim, trailing stop included: the message is
					// observable and `cachekey-caches-match-options-not-a-
					// dictionary` compares it against the browser's
					detail: "The provided value is not of type 'MultiCacheQueryOptions'.",
				});
			}

			const key = cacheKey(request);
			let cacheName: string | undefined;

			if (options !== undefined && options !== null) {
				const ignoreMethod = options.ignoreMethod;
				const ignoreSearch = options.ignoreSearch;
				const ignoreVary = options.ignoreVary;
				const rawCacheName = options.cacheName;
				cacheName =
					rawCacheName === undefined ? undefined : scopedName(rawCacheName);
				options = {
					ignoreMethod: ignoreMethod === undefined ? undefined : !!ignoreMethod,
					ignoreSearch: ignoreSearch === undefined ? undefined : !!ignoreSearch,
					ignoreVary: ignoreVary === undefined ? undefined : !!ignoreVary,
				};
			}

			// named: the search is one cache, and `scopedName` has already
			// confined that name to this origin
			if (cacheName !== undefined) {
				return tag(await super.match(key, { ...options, cacheName }));
			}

			// https://w3c.github.io/ServiceWorker/#cache-storage-match
			//
			// Unnamed, the spec walks *every* cache in the storage in insertion
			// order and answers with the first match. Every proxied site shares
			// one real storage, so delegating that walk searched every other
			// site's caches too - and the key is the site's own URL, so a site
			// that could guess a URL another had cached read the response back,
			// body and all. Scoping the name at `open()` never entered into it,
			// because this walk does not look at names.
			//
			// So walk ours, in the same order: `keys()` answers in insertion
			// order, and the prefix filter is the whole of the fix.
			const names = await super.keys();
			const prefix = scopePrefix();

			for (let i = 0; i < names.length; i++) {
				if (!String_startsWith(names[i], prefix)) continue;

				// sequential on purpose - the spec's answer is the first match
				// in insertion order, so a later cache must not be able to win
				// eslint-disable-next-line no-await-in-loop
				const cache = await super.open(names[i]);
				// through the native rather than the page-visible
				// `Cache.prototype.match`, which would run `cacheKey` a second
				// time over a key that has already been through it
				// eslint-disable-next-line no-await-in-loop
				const response = await new client.native.Cache(cache).match(
					key,
					options
				);
				if (response) return tag(response);
			}

			return undefined;
		}

		@Returns("Promise<boolean>")
		@Arguments("DOMString")
		delete(cacheName: string): Promise<boolean> {
			return super.delete(scopedName(cacheName));
		}

		@Returns("Promise<sequence<DOMString>>")
		@Arguments()
		async keys(): Promise<string[]> {
			const names = await super.keys();
			const prefix = scopePrefix();
			const visible: string[] = [];

			for (let i = 0; i < names.length; i++) {
				if (String_startsWith(names[i], prefix)) {
					visible[visible.length] = String_substring(names[i], prefix.length);
				}
			}

			return visible;
		}
	});
}

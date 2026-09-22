import { Object_getOwnPropertyDescriptor } from "@/shared/snapshot";
import { SCRAMJETCLIENT } from "@/symbols";
// type-only: `client.ts` imports from here, and a value import would close the
// cycle at runtime
import type { ScramjetClient } from "./client";
import { dictionaryReader } from "./webidl";

export function getOwnPropertyDescriptorHandler(target, prop) {
	const realDescriptor = Object_getOwnPropertyDescriptor(target, prop);

	return realDescriptor;
}

/**
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#window-open-steps
 *
 * Shared by `window.open` and the three-argument `document.open`, which is the
 * same operation reached under another name.
 *
 */
export function openWindowSteps(
	client: ScramjetClient,
	nativeOpen: (
		url?: string,
		target?: string,
		features?: string
	) => Window | null,
	url?: string,
	target?: string,
	features?: string
): Window | null {
	// `url` defaults to the empty string, which opens about:blank - so an absent
	// argument and an explicit "" mean the same thing and neither is a URL to
	// rewrite. Anything else is.
	const href = url === undefined || url === "" ? url : client.rewriteUrl(url);

	if (target !== undefined && target !== null) {
		if (target === "_top" || target === "_unfencedTop") {
			target = client.meta.topFrameName;
		}
		if (target === "_parent") {
			target = client.meta.parentFrameName;
		}
	}

	const realwin = nativeOpen(href, target, features);
	if (!realwin) return realwin;

	// i don't believe it's possible for a just-opened window to already have scramjet loaded but guard just in case
	if (!(SCRAMJETCLIENT in realwin)) {
		client.init.hookSubcontext(realwin as Self);
	}

	return realwin;
}

/* eslint-disable quotes -- an IDL member declaration reads as spec text, and
   escaping the string defaults inside it would make that unreadable */

// ---------------------------------------------------------------------------
// dictionary readers
//
// Every one of these is a dictionary an interceptor *reimplements* rather than
// hands to the native, which is the only case that needs one: a body that peeks
// at a member and then passes the same object onward runs that page-controlled
// getter twice. `dictionaryReader` reads each member once, in WebIDL's order,
// and converts it by its declared type.
//
// The declarations are the spec's own IDL. Keep them that way - the point of
// the grammar is that a member can be checked against the spec by eye.
// ---------------------------------------------------------------------------

/** https://html.spec.whatwg.org/multipage/workers.html#dictdef-workeroptions */
export const readWorkerOptions = dictionaryReader("WorkerOptions", {
	credentials: `RequestCredentials = "same-origin"`,
	name: `DOMString = ""`,
	type: `WorkerType = "classic"`,
});

/** https://drafts.css-houdini.org/worklets/#dictdef-workletoptions */
export const readWorkletOptions = dictionaryReader("WorkletOptions", {
	credentials: `RequestCredentials = "same-origin"`,
});

/** https://html.spec.whatwg.org/multipage/server-sent-events.html#dictdef-eventsourceinit */
export const readEventSourceInit = dictionaryReader("EventSourceInit", {
	withCredentials: `boolean = false`,
});

/**
 * https://dom.spec.whatwg.org/#dictdef-addeventlisteneroptions
 *
 * `passive` has no default in the IDL. The browser computes one per event type,
 * so forcing `false` would change scrolling behaviour - it has to stay absent
 * when the page omitted it, which is what a member with no default does here.
 */
export const readAddEventListenerOptions = dictionaryReader(
	"AddEventListenerOptions",
	{
		capture: `boolean = false`,
		once: `boolean = false`,
		passive: `boolean`,
		signal: `AbortSignal`,
	}
);

/** https://dom.spec.whatwg.org/#dictdef-eventlisteneroptions */
export const readEventListenerOptions = dictionaryReader(
	"EventListenerOptions",
	{
		capture: `boolean = false`,
	}
);

/** https://cookiestore.spec.whatwg.org/#dictdef-cookiestoregetoptions */
export const readCookieStoreGetOptions = dictionaryReader(
	"CookieStoreGetOptions",
	{
		name: `USVString`,
		url: `USVString`,
	}
);

/** https://cookiestore.spec.whatwg.org/#dictdef-cookieinit */
export const readCookieInit = dictionaryReader("CookieInit", {
	domain: `USVString? = null`,
	expires: `DOMHighResTimeStamp? = null`,
	name: `required USVString`,
	partitioned: `boolean = false`,
	path: `USVString = "/"`,
	sameSite: `CookieSameSite = "strict"`,
	value: `required USVString`,
});

/** https://cookiestore.spec.whatwg.org/#dictdef-cookiestoredeleteoptions */
export const readCookieStoreDeleteOptions = dictionaryReader(
	"CookieStoreDeleteOptions",
	{
		domain: `USVString? = null`,
		name: `required USVString`,
		partitioned: `boolean = false`,
		path: `USVString = "/"`,
	}
);

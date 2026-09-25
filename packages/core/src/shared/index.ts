import { ScramjetConfig, ScramjetFlags } from "@/types";
import type { Document, Element } from "./htmlparser";
import { URLMeta } from "@rewriters/url";
import { CookieJar } from "./cookie";
import { TapInstance } from "@/Tap";
import { HtmlContext } from "@/shared/rewriters/html";
import {
	String_endsWith,
	String_startsWith,
	String_substring,
	String_toLowerCase,
} from "./snapshot";

export * from "./cookie";
export * from "./headers";
export * from "./htmlRules";
export * from "./mime";
export * from "./rewriters";

/**
 * The URL whose flags a context runs with: its top-level frame's, so that a
 * subframe - or a script, or a worker - never picks different flags than the
 * page it is part of. `fallback` is for a meta that was built without one.
 *
 * Only this URL's hostname is ever looked at (see {@link flagValue}).
 */
export function flagsUrl(meta: URLMeta, fallback: URL = meta.base): URL {
	return meta.topUrl ?? fallback;
}

/** the flags whose value is a boolean, which is all but `incumbency` */
export type BooleanFlag = {
	[K in keyof ScramjetFlags]: ScramjetFlags[K] extends boolean ? K : never;
}[keyof ScramjetFlags];

/**
 * Whether a `siteFlags` key covers `hostname`: `example.com` matches that
 * host alone, `*.example.com` matches it and every subdomain of it, and `*`
 * matches everything.
 */
export function siteFlagsMatch(pattern: string, hostname: string): boolean {
	pattern = String_toLowerCase(pattern);
	if (pattern === "*") return true;
	if (String_startsWith(pattern, "*.")) {
		const domain = String_substring(pattern, 2);
		return hostname === domain || String_endsWith(hostname, "." + domain);
	}

	return hostname === pattern;
}

/**
 * A flag's value for one top-level frame: the configured default, unless a
 * `siteFlags` key matches its hostname and overrides it. The first matching
 * key that sets the flag wins.
 *
 * Flags depend on the hostname of the top-level frame and nothing else, so
 * they are fixed for the life of a document: the path, query and fragment
 * never matter, `pushState` cannot change them, and every subframe, worker
 * and script under that frame agrees with it. A URL with no host
 * (`about:blank`, `data:`, `blob:`) only matches `*`.
 *
 * `url` should be a top-level frame's (see {@link flagsUrl}).
 */
export function flagValue<K extends keyof ScramjetFlags>(
	flag: K,
	context: ScramjetContext,
	url: URL
): ScramjetFlags[K] {
	const hostname = url.hostname;
	for (const pattern in context.config.siteFlags) {
		const partialflags = context.config.siteFlags[pattern];
		if (flag in partialflags && siteFlagsMatch(pattern, hostname)) {
			return partialflags[flag] as ScramjetFlags[K];
		}
	}

	return context.config.flags[flag];
}

/**
 * `flagValue` for the boolean flags. Kept separate so that a flag which is not
 * a boolean - `incumbency` - cannot be read as if it were one, where every
 * mode including `"none"` would come back truthy.
 */
export function flagEnabled(
	flag: BooleanFlag,
	context: ScramjetContext,
	url: URL
): boolean {
	return flagValue(flag, context, url);
}
export type ScramjetInterface = {
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;

	getInjectScripts(
		meta: URLMeta,
		root: Document,
		htmlcontext: HtmlContext,
		script: (src: string) => Element
	): Element[];
	getWorkerInjectScripts?(
		meta: URLMeta,
		isModule: boolean,
		script: (src: string) => string
	): string;
};

export type ScramjetContext = {
	config: ScramjetConfig;
	prefix: URL;
	interface: ScramjetInterface;
	cookieJar: CookieJar;
	hooks?: {
		rewriter: {
			html: TapInstance<HtmlRewriterHooks>;
		};
	};
};

export type HtmlRewriterHooks = {
	pre: {
		context: {
			root: Document;
			meta: URLMeta;
			origHtml: string;
			htmlcontext: HtmlContext;
		};
	};
	post: {
		context: {
			root: Document;
			meta: URLMeta;
			origHtml: string;
			htmlcontext: HtmlContext;
		};
		props: {
			setRawHtml?: string;
		};
	};
};

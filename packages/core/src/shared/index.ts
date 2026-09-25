import { ScramjetConfig, ScramjetFlags } from "@/types";
import type { Document, Element } from "./htmlparser";
import { URLMeta } from "@rewriters/url";
import { CookieJar } from "./cookie";
import { TapInstance } from "@/Tap";
import { HtmlContext } from "@/shared/rewriters/html";

export * from "./cookie";
export * from "./headers";
export * from "./htmlRules";
export * from "./mime";
export * from "./rewriters";

/** the flags whose value is a boolean, which is all but `incumbency` */
export type BooleanFlag = {
	[K in keyof ScramjetFlags]: ScramjetFlags[K] extends boolean ? K : never;
}[keyof ScramjetFlags];

/**
 * A flag's value. Flags are fixed for a context: an embedder that wants
 * different flags for different sites hands each its own config.
 */
export function flagValue<K extends keyof ScramjetFlags>(
	flag: K,
	context: ScramjetContext
): ScramjetFlags[K] {
	return context.config.flags[flag];
}

/**
 * `flagValue` for the boolean flags. Kept separate so that a flag which is not
 * a boolean - `incumbency` - cannot be read as if it were one, where every
 * mode including `"none"` would come back truthy.
 */
export function flagEnabled(
	flag: BooleanFlag,
	context: ScramjetContext
): boolean {
	return flagValue(flag, context);
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

import { ScramjetConfig, ScramjetFlags, ScramjetVersionInfo } from "@/types";
import DomHandler, { Element } from "domhandler";
import { URLMeta } from "@rewriters/url";
import { CookieJar } from "./cookie";
import { Tap, TapInstance } from "@/Tap";
import { ScramjetFetchParsed, ScramjetFetchRequest } from "@/fetch";

export * from "./cookie";
export * from "./headers";
export * from "./htmlRules";
export * from "./rewriters";
export * from "./security";

export function flagEnabled(
	flag: keyof ScramjetFlags,
	context: ScramjetContext,
	url: URL
): boolean {
	const value = context.config.flags[flag];
	for (const regex in context.config.siteFlags) {
		const partialflags = context.config.siteFlags[regex];
		if (new RegExp(regex).test(url.href) && flag in partialflags) {
			return partialflags[flag];
		}
	}

	return value;
}
export type ScramjetInterface = {
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;

	getInjectScripts(
		meta: URLMeta,
		handler: DomHandler,
		script: (src: string) => Element
	): Element[];
	getWorkerInjectScripts?(
		meta: URLMeta,
		type: "module" | "regular",
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

export const versionInfo: ScramjetVersionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};

export type HtmlRewriterHooks = {
	pre: {
		context: {
			handler: DomHandler;
			meta: URLMeta;
			fromTop: boolean;
			origHtml: string;
		};
	};
	post: {
		context: {
			handler: DomHandler;
			meta: URLMeta;
			fromTop: boolean;
			origHtml: string;
		};
		props: {
			setRawHtml?: string;
		};
	};
};

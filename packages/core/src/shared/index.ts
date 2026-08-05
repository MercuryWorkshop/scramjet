import { AkConfig, AkFlags, AkVersionInfo } from "@/types";
import DomHandler, { Element } from "domhandler";
import { URLMeta } from "@rewriters/url";
import { CookieJar } from "./cookie";
import { TapInstance } from "@/Tap";
import { HtmlContext } from "@/shared/rewriters/html";
import { _RegExp } from "./snapshot";

export * from "./cookie";
export * from "./headers";
export * from "./htmlRules";
export * from "./mime";
export * from "./rewriters";

export function flagEnabled(
	flag: keyof AkFlags,
	context: AkContext,
	url: URL
): boolean {
	const value = context.config.flags[flag];
	for (const regex in context.config.siteFlags) {
		const partialflags = context.config.siteFlags[regex];
		if (new _RegExp(regex).test(url.href) && flag in partialflags) {
			return partialflags[flag];
		}
	}

	return value;
}
export type AkInterface = {
	codecEncode: (input: string) => string;
	codecDecode: (input: string) => string;

	getInjectScripts(
		meta: URLMeta,
		handler: DomHandler,
		htmlcontext: HtmlContext,
		script: (src: string) => Element
	): Element[];
	getWorkerInjectScripts?(
		meta: URLMeta,
		isModule: boolean,
		script: (src: string) => string
	): string;
};

export type AkContext = {
	config: AkConfig;
	prefix: URL;
	interface: AkInterface;
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
			handler: DomHandler;
			meta: URLMeta;
			origHtml: string;
			htmlcontext: HtmlContext;
		};
	};
	post: {
		context: {
			handler: DomHandler;
			meta: URLMeta;
			origHtml: string;
			htmlcontext: HtmlContext;
		};
		props: {
			setRawHtml?: string;
		};
	};
};

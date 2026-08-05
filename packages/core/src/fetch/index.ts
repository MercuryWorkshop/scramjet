import {
	BareCompatibleClient,
	BareResponse,
	ProxyTransport,
	BareRequestInit,
} from "@mercuryworkshop/proxy-transports";

import { type URLMeta } from "@rewriters/url";
import { type AkRequestMode } from "./parse";
import { AkHeaders } from "@/shared/headers";
import { HtmlRewriterHooks, AkContext } from "@/shared";
import { Tap, TapInstance } from "@/Tap";
import { doHandleFetch } from "./fetch";
import { _URL, _Map } from "@/shared/snapshot";

export interface AkFetchRequest {
	rawUrl: URL;
	rawReferrer: string | null;
	// use parsed.destination instead
	rawDestination: RequestDestination;
	mode: RequestMode;
	referrer: string;
	method: string;
	body: BodyType | null;
	cache: RequestCache;

	initialHeaders: AkHeaders;

	rawClientUrl?: URL;

	/** The service worker FetchEvent.clientId that originated this request. */
	clientId: string;
}

export interface AkFetchParsed {
	url: _URL;
	clientUrl?: _URL;
	referrerSourceUrl?: _URL | null;
	hadExtraParams: boolean;
	crossSiteRedirect: boolean;

	// track the worst case Sec-Fetch-Site classification through redirects
	fetchSiteState?: "same-origin" | "same-site" | "cross-site";

	// origin of the page that initialized the request
	// specifically for tracking Sec-Fetch-Site, don't use for anything else, it will diverge from clientUrl in some cases
	fetchInitiatorOrigin?: string;

	// was the request made with credentials=include?
	fetchCredentialsInclude?: boolean;

	// tracks RequestInit.mode if set
	fetchMode?: AkRequestMode;

	// was this request made by an iframe? (scramjet's definition of an iframe, not the browser's)
	isIframe?: boolean;

	// request.destination, but is overridden by $dest
	destination: RequestDestination;

	meta: URLMeta;
	isModule: boolean;
	isFakeDataURL: boolean;
	referrerPolicy?: string;
	trackedClient?: AkFetchTrackedClient;
}

export interface AkFetchResponse {
	body: BodyType;
	headers: AkHeaders;
	status: number;
	statusText: string;
}

export type CookieSyncEntry = {
	url: URL;
	cookie: string;
};

export type CookieSyncOptions = {
	clear?: boolean;
	destination?: RequestDestination;
};

export type FetchHandlerInit = {
	transport: ProxyTransport;
	context: AkContext;
	crossOriginIsolated?: boolean;

	sendSetCookie: (
		cookies: CookieSyncEntry[],
		options?: CookieSyncOptions
	) => Promise<void>;
	fetchDataUrl(dataUrl: string): Promise<BareResponse>;
	fetchBlobUrl(blobUrl: string): Promise<BareResponse>;
};

export type TrackedHistoryState = {
	url: string;
	refererPolicy?: string;
};
export class AkFetchTrackedClient {
	history: TrackedHistoryState[] = [];
	constructor(public clientId: string) {}
}

// eslint-disable-next-line scramjet-core/no-globals
export class AkFetchHandler extends EventTarget {
	public client: BareCompatibleClient;
	public crossOriginIsolated: boolean = false;
	public context: AkContext;

	public trackedClients = new _Map<string, AkFetchTrackedClient>();

	public hooks: {
		rewriter: {
			html: TapInstance<HtmlRewriterHooks>;
		};
		fetch: TapInstance<FetchHooks>;
	};

	public fetchDataUrl: (dataUrl: string) => Promise<Response>;
	public fetchBlobUrl: (blobUrl: string) => Promise<Response>;
	public sendSetCookie: (
		cookies: CookieSyncEntry[],
		options?: CookieSyncOptions
	) => Promise<void>;

	constructor(init: FetchHandlerInit) {
		super();
		this.client = new BareCompatibleClient(init.transport);
		this.context = init.context;
		this.crossOriginIsolated = init.crossOriginIsolated || false;
		this.sendSetCookie = init.sendSetCookie;
		this.fetchDataUrl = init.fetchDataUrl;
		this.fetchBlobUrl = init.fetchBlobUrl;
		this.hooks = {
			rewriter: {
				html: Tap.create<HtmlRewriterHooks>(),
			},
			fetch: Tap.create<FetchHooks>(),
		};
		this.context.hooks = {
			rewriter: this.hooks.rewriter,
		};
	}

	async handleFetch(
		request: AkFetchRequest
	): Promise<AkFetchResponse> {
		return doHandleFetch(this, request);
	}
}
export type FetchHooks = {
	intercept: {
		context: {
			request: AkFetchRequest;
			parsed: AkFetchParsed;
		};
		props: {
			response?: AkFetchResponse;
		};
	};
	request: {
		context: {
			request: AkFetchRequest;
			parsed: AkFetchParsed;
			client: BareCompatibleClient;
		};
		props: {
			init: BareRequestInit;
			url: URL;
			earlyResponse?: BareResponse;
		};
	};
	preresponse: {
		context: {
			request: AkFetchRequest;
			parsed: AkFetchParsed;
		};
		props: {
			response: BareResponse;
		};
	};
	response: {
		context: {
			request: AkFetchRequest;
			parsed: AkFetchParsed;
		};
		props: {
			response: AkFetchResponse;
		};
	};
};

export type BodyType = string | ArrayBuffer | Blob | ReadableStream<any>;

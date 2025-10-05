/**
 * @fileoverview Contains the core Service Worker logic for Scramjet, which handles the initial request interception and handles client management for the Scramjet service.
 */

import { handleFetch, ScramjetFetchContext } from "@/worker/fetch";
import { BareClient } from "@mercuryworkshop/bare-mux-custom";
import { ScramjetConfig, ScramjetDB } from "@/types";
import { asyncSetWasm } from "@rewriters/wasm";
import { CookieJar } from "@/shared/cookie";
import {
	bareTransport,
	ScramjetHeaders,
	setConfig,
	unrewriteUrl,
} from "@/shared";
import { openDB } from "idb";
import { ScramjetDownload } from "@client/events";
import { renderError } from "./error";

export * from "./error";
export * from "./fetch";

/**
 * Main `ScramjetServiceWorker` class created by the `$scramjetLoadWorker` factory, which handles routing the proxy and contains the core logic for request interception.
 */
export class ScramjetServiceWorker extends EventTarget {
	/**
	 * `BareClient` instance to fetch requests under a chosen proxy transport.
	 */
	client: BareClient;
	/**
	 * Current ScramjetConfig saved in memory.
	 */
	config: ScramjetConfig;

	/**
	 * Recorded sync messages in the message queue.
	 */
	syncPool: Record<number, (val?: any) => void> = {};
	/**
	 * Current sync token for collected messages in the queue.
	 */
	synctoken = 0;

	/**
	 * Scramjet's cookie jar for cookie emulation through other storage means, connected to a client.
	 */
	cookieStore = new CookieJar();

	/**
	 * Initializes the `BareClient` Scramjet uses to fetch requests under a chosen proxy transport, the cookie jar store for proxifying cookies, and inits the listeners for emulation features and dynamic configs set through the Scramjet Controller.
	 */
	constructor() {
		super();

		(async () => {
			const db = await openDB<ScramjetDB>("$scramjet", 1);
			const cookies = await db.get("cookies", "cookies");
			if (cookies) {
				this.cookieStore.load(cookies);
			}
		})();

		addEventListener("message", async ({ data }: { data: MessageC2W }) => {
			if (!("scramjet$type" in data)) return;

			if ("scramjet$token" in data) {
				// (ack message)
				const cb = this.syncPool[data.scramjet$token];
				delete this.syncPool[data.scramjet$token];
				cb(data);

				return;
			}

			if (data.scramjet$type === "cookie") {
				this.cookieStore.setCookies([data.cookie], new URL(data.url));
				const db = await openDB<ScramjetDB>("$scramjet", 1);
				await db.put("cookies", JSON.parse(this.cookieStore.dump()), "cookies");
			}

			if (data.scramjet$type === "loadConfig") {
				this.config = data.config;
			}
		});
	}

	/**
	 * Dispatches a message in the message queues.
	 */
	async dispatch(client: Client, data: MessageW2C): Promise<MessageC2W> {
		const token = this.synctoken++;
		let cb: (val: MessageC2W) => void;
		const promise: Promise<MessageC2W> = new Promise((r) => (cb = r));
		this.syncPool[token] = cb;
		data.scramjet$token = token;

		client.postMessage(data);

		return await promise;
	}

	/**
	 * Persists the current Scramjet config into an IndexedDB store.
	 * Remember, this is because the Scramjet config can be dynamically updated via the Scramjet Controller APIs.
	 *
	 * @example
	 * self.addEventListener("fetch", async (ev) => {
	 *   await scramjet.loadConfig();
	 *
	 *   ...
	 * });
	 */
	async loadConfig() {
		if (this.config) return;

		const db = await openDB<ScramjetDB>("$scramjet", 1);
		this.config = await db.get("config", "config");

		if (this.config) {
			setConfig(this.config);
			this.client = new BareClient(bareTransport!);
			await asyncSetWasm();
		}
	}

	/**
	 * Whether to route a request from a `FetchEvent` in Scramjet.
	 *
	 * @example
	 * self.addEventListener("fetch", async (ev) => {
	 *   ...
	 *
	 *   if (scramjet.route(ev)) {
	 *     ...
	 *   }
	 * });
	 * ```
	 */
	route({ request }: FetchEvent) {
		if (request.url.startsWith(location.origin + this.config.prefix))
			return true;
		else if (request.url.startsWith(location.origin + this.config.files.wasm))
			return true;
		else return false;
	}

	/**
	 * Handles a `FetchEvent` to be routed in Scramjet.
	 * This is the heart of adding Scramjet support to your web proxy.
	 *
	 * @example
	 * self.addEventListener("fetch", async (ev) => {
	 *   ...
	 *
	 *   if (scramjet.route(ev)) {
	 *     ev.respondWith(scramjet.fetch(ev));
	 *   }
	 * });
	 */
	async fetch({ request }: FetchEvent) {
		if (!this.config) await this.loadConfig();

		// const client = await self.clients.get(clientId);

		let url = new URL(request.url);

		if (url.pathname === this.config.files.wasm) {
			return fetch(this.config.files.wasm).then(async (x) => {
				const buf = await x.arrayBuffer();
				const b64 = btoa(
					new Uint8Array(buf)
						.reduce(
							(data, byte) => (data.push(String.fromCharCode(byte)), data),
							[]
						)
						.join("")
				);

				let payload = "";
				payload +=
					"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
				payload += `self.WASM = '${b64}';`;

				return new Response(payload, {
					headers: { "content-type": "text/javascript" },
				});
			});
		}

		try {
			const headers = new ScramjetHeaders();
			for (const [key, value] of request.headers.entries()) {
				headers.set(key, value);
			}
			const context: ScramjetFetchContext = {
				rawUrl: new URL(request.url),
				destination: request.destination,
				mode: request.mode,
				referrer: request.referrer,
				method: request.method,
				body: request.body,
				cache: request.cache,
				forceCrossOriginIsolated: crossOriginIsolated,
				initialHeaders: headers,
				cookieStore: this.cookieStore,
			};
			const resp = await handleFetch.call(
				this,
				context,
				this.config,
				this.client,
				new URL(location.protocol + location.host + this.config.prefix)
			);

			return new Response(resp.body, {
				status: resp.status,
				statusText: resp.statusText,
				headers: resp.headers,
			});
		} catch (err) {
			const errorDetails = {
				message: err.message,
				url: request.url,
				destination: request.destination,
			};
			if (err.stack) {
				errorDetails["stack"] = err.stack;
			}

			console.error("ERROR FROM SERVICE WORKER FETCH: ", errorDetails);
			console.error(err);

			if (!["document", "iframe"].includes(request.destination))
				return new Response(undefined, { status: 500 });

			const formattedError = Object.entries(errorDetails)
				.map(
					([key, value]) =>
						`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`
				)
				.join("\n\n");

			return renderError(
				formattedError,
				unrewriteUrl(request.url, {
					prefix: location.origin + this.config.prefix,
				} as any)
			);
		}
	}
}

/**
 * Scramjet fake Service Worker event message.
 * Contains a `scramjet$type` for identifying the message.
 */
type RegisterServiceWorkerMessage = {
	scramjet$type: "registerServiceWorker";
	port: MessagePort;
	origin: string;
};

/**
 * Scramjet cookie jar event message.
 * Contains a `scramjet$type` for identifying the message.
 */
type CookieMessage = {
	scramjet$type: "cookie";
	cookie: string;
	url: string;
};

/**
 * Scramjet config event message.
 * Contains a `scramjet$type` for identifying the message.
 */
type ConfigMessage = {
	scramjet$type: "loadConfig";
	config: ScramjetConfig;
};

/**
 * Scramjet proxified download event message.
 * Contains a `scramjet$type` for identifying the message.
 */
type DownloadMessage = {
	scramjet$type: "download";
	download: ScramjetDownload;
};
/**
 * Default Scramjet message.
 * Contains a `scramjet$type` for identifying the message.
 */
type MessageCommon = {
	scramjet$token?: number;
};

/**
 * Message types sent from the client to the Service Worker.
 * These are routed by their `scramjet$type` to identify the messages apart from each other.
 */
type MessageTypeC2W =
	| RegisterServiceWorkerMessage
	| CookieMessage
	| ConfigMessage;
/**
 * w2c (types): Message types sent from the Service Worker to the client.
 */
type MessageTypeW2C = CookieMessage | DownloadMessage;

/** c2w: client to Service Worker */
export type MessageC2W = MessageCommon & MessageTypeC2W;
/** w2c: Service Worker to client */
export type MessageW2C = MessageCommon & MessageTypeW2C;

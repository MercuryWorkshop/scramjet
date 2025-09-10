import { FakeServiceWorker } from "@/worker/fakesw";
import { handleFetch } from "@/worker/fetch";
import { BareClient } from "../bare-mux-custom";
import { ScramjetConfig } from "@/types";
import { asyncSetWasm } from "@rewriters/wasm";
import { CookieStore } from "@/shared/cookie";
import { config, loadCodecs, setConfig, unrewriteUrl } from "@/shared";
import { ScramjetDownload } from "@client/events";
import { renderError } from "./error";

export * from "./error";
export * from "./fetch";
export * from "./fakesw";

export class ScramjetServiceWorker extends EventTarget {
	client: BareClient;
	config: ScramjetConfig;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	cookieStore = new CookieStore();

	serviceWorkers: FakeServiceWorker[] = [];

	constructor() {
		super();

		const db = indexedDB.open("$scramjet", 1);

		db.onsuccess = () => {
			const res = db.result;
			const tx = res.transaction("cookies", "readonly");
			const store = tx.objectStore("cookies");
			const cookies = store.get("cookies");

			cookies.onsuccess = () => {
				if (cookies.result) {
					this.cookieStore.load(cookies.result);
				}
			};
		};

		addEventListener("message", async ({ data }: { data: MessageC2W }) => {
			if (!("scramjet$type" in data)) return;

			if ("scramjet$token" in data) {
				// (ack message)
				const cb = this.syncPool[data.scramjet$token];
				delete this.syncPool[data.scramjet$token];
				cb(data);

				return;
			}

			if (data.scramjet$type === "registerServiceWorker") {
				this.serviceWorkers.push(new FakeServiceWorker(data.port, data.origin));

				return;
			}

			if (data.scramjet$type === "cookie") {
				this.cookieStore.setCookies([data.cookie], new URL(data.url));
				const res = db.result;
				const tx = res.transaction("cookies", "readwrite");
				const store = tx.objectStore("cookies");
				store.put(JSON.parse(this.cookieStore.dump()), "cookies");
			}

			if (data.scramjet$type === "loadConfig") {
				this.config = data.config;
			}
		});
	}

	async dispatch(client: Client, data: MessageW2C): Promise<MessageC2W> {
		const token = this.synctoken++;
		let cb: (val: MessageC2W) => void;
		const promise: Promise<MessageC2W> = new Promise((r) => (cb = r));
		this.syncPool[token] = cb;
		data.scramjet$token = token;

		client.postMessage(data);

		return await promise;
	}

	async loadConfig() {
		if (this.config) return;

		const request = indexedDB.open("$scramjet", 1);

		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const db = request.result;
				const tx = db.transaction("config", "readonly");
				const store = tx.objectStore("config");
				const storedconfig = store.get("config");

				storedconfig.onsuccess = async () => {
					this.config = storedconfig.result;
					setConfig(storedconfig.result);
					this.client = new BareClient();

					await asyncSetWasm();

					resolve();
				};
				storedconfig.onerror = () => reject(storedconfig.error);
			};

			request.onerror = () => reject(request.error);
		});
	}

	route({ request }: FetchEvent) {
		if (request.url.startsWith(location.origin + this.config.prefix))
			return true;
		else if (request.url.startsWith(location.origin + this.config.files.wasm))
			return true;
		else return false;
	}

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
			return handleFetch.call(this, request, this.client);
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

type RegisterServiceWorkerMessage = {
	scramjet$type: "registerServiceWorker";
	port: MessagePort;
	origin: string;
};

type CookieMessage = {
	scramjet$type: "cookie";
	cookie: string;
	url: string;
};

type ConfigMessage = {
	scramjet$type: "loadConfig";
	config: ScramjetConfig;
};

type DownloadMessage = {
	scramjet$type: "download";
	download: ScramjetDownload;
};
type MessageCommon = {
	scramjet$token?: number;
};

type MessageTypeC2W =
	| RegisterServiceWorkerMessage
	| CookieMessage
	| ConfigMessage;
type MessageTypeW2C = CookieMessage | DownloadMessage;

// c2w: client to (service) worker
export type MessageC2W = MessageCommon & MessageTypeC2W;
export type MessageW2C = MessageCommon & MessageTypeW2C;

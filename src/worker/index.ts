import { FakeServiceWorker } from "./fakesw";
import { swfetch } from "./fetch";
import { ScramjetThreadpool } from "./threadpool";
import type BareClient from "@mercuryworkshop/bare-mux";
import { ScramjetConfig } from "../types";

export class ScramjetServiceWorker extends EventTarget {
	client: BareClient;
	config: typeof self.$scramjet.config;
	threadpool: ScramjetThreadpool;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	cookieStore = new self.$scramjet.shared.CookieStore();

	serviceWorkers: FakeServiceWorker[] = [];

	constructor() {
		super();
		this.client = new self.$scramjet.shared.util.BareClient();

		this.threadpool = new ScramjetThreadpool();

		this.cookieStore.load

		addEventListener("message", ({ data }: { data: MessageC2W }) => {
			if (!("scramjet$type" in data)) return;

			if (data.scramjet$type === "registerServiceWorker") {
				this.serviceWorkers.push(new FakeServiceWorker(data.port, data.origin));

				return;
			}

			if (data.scramjet$type === "cookie") {
				this.cookieStore.setCookies([data.cookie], new URL(data.url));
			}
		});
	}

	async loadConfig() {
		if (this.config) return;

		// const store = new IDBMap("config", {
		// 	prefix: "scramjet",
		// });

		// if (store.has("config")) {
		// 	const config = await store.get("config");
		// 	this.config = config;
		// 	self.$scramjet.config = config;
		// 	self.$scramjet.codec = self.$scramjet.codecs[config.codec];
		// }

		// Recreate the above code using the stock IDB API

		const request = indexedDB.open("$scramjet", 1);

		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const db = request.result;
				const tx = db.transaction("config", "readonly");
				const store = tx.objectStore("config");
				const config = store.get("config")

				config.onsuccess = () => {
					this.config = config.result;
					self.$scramjet.config = config.result;
					self.$scramjet.codec = self.$scramjet.codecs[config.result.codec];

					resolve();
				};

				config.onerror = () => reject(config.error);
			};

			request.onerror = () => reject(request.error);
		});
		
	}

	route({ request }: FetchEvent) {
		if (request.url.startsWith(location.origin + this.config.prefix))
			return true;
		else return false;
	}

	async fetch({ request, clientId }: FetchEvent) {
		const client = await self.clients.get(clientId);

		return swfetch.call(this, request, client);
	}
}

// @ts-ignore
self.ScramjetServiceWorker = ScramjetServiceWorker;

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

type MessageCommon = {
	scramjet$type: string;
	scramjet$token: number;
};

type MessageTypeC2W = RegisterServiceWorkerMessage | CookieMessage;
type MessageTypeW2C = CookieMessage;

// c2w: client to (service) worker
export type MessageC2W = MessageCommon & MessageTypeC2W;
export type MessageW2C = MessageCommon & MessageTypeW2C;

import { FakeServiceWorker } from "./fakesw";
import { swfetch } from "./fetch";
import type BareClient from "@mercuryworkshop/bare-mux";
import { ScramjetConfig } from "../types";
import { $scramjet, loadCodecs } from "../scramjet";

export class ScramjetServiceWorker extends EventTarget {
	client: BareClient;
	config: ScramjetConfig;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	cookieStore = new $scramjet.shared.CookieStore();

	serviceWorkers: FakeServiceWorker[] = [];

	constructor() {
		super();
		this.client = new $scramjet.shared.util.BareClient();

		const db = indexedDB.open("$scramjet", 1);

		db.onsuccess = () => {
			const res = db.result;
			const tx = res.transaction("cookies", "readonly");
			const store = tx.objectStore("cookies");
			const cookies = store.get("cookies");

			cookies.onsuccess = () => {
				if (cookies.result) {
					this.cookieStore.load(cookies.result);
					dbg.log("Loaded cookies from IDB!");
				}
			};
		};

		addEventListener("message", async ({ data }: { data: MessageC2W }) => {
			if (!("scramjet$type" in data)) return;

			if (data.scramjet$type === "registerServiceWorker") {
				this.serviceWorkers.push(new FakeServiceWorker(data.port, data.origin));

				return;
			}

			if (data.scramjet$type === "cookie") {
				await this.cookieStore.setCookies([data.cookie], new URL(data.url));
				const res = db.result;
				const tx = res.transaction("cookies", "readwrite");
				const store = tx.objectStore("cookies");
				store.put(this.cookieStore.dump(), "cookies");
			}
		});
	}

	async loadConfig() {
		if (this.config) return;

		const request = indexedDB.open("$scramjet", 1);

		return new Promise<void>((resolve, reject) => {
			request.onsuccess = async () => {
				const db = request.result;
				const tx = db.transaction("config", "readonly");
				const store = tx.objectStore("config");
				const config = store.get("config");

				config.onsuccess = () => {
					this.config = config.result;
					$scramjet.config = config.result;

					loadCodecs();

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

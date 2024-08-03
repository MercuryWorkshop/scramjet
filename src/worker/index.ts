import IDBMap from "@webreflection/idb-map";
import { FakeServiceWorker } from "./fakesw";
import { swfetch } from "./fetch";
import { ScramjetThreadpool } from "./threadpool";

declare global {
	interface Window {
		ScramjetServiceWorker;
	}
}

export class ScramjetServiceWorker {
	client: typeof self.$scramjet.shared.util.BareClient.prototype;
	config: typeof self.$scramjet.config;
	threadpool: ScramjetThreadpool;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	serviceWorkers: FakeServiceWorker[] = [];

	constructor() {
		this.client = new self.$scramjet.shared.util.BareClient();

		this.threadpool = new ScramjetThreadpool();

		addEventListener("message", ({ data }: { data: MessageC2W }) => {
			if (!("scramjet$type" in data)) return;

			if (data.scramjet$type === "registerServiceWorker") {
				this.serviceWorkers.push(new FakeServiceWorker(data.port, data.origin));

				return;
			}

			const resolve = this.syncPool[data.scramjet$token];
			delete this.syncPool[data.scramjet$token];
		});
	}

	async loadConfig() {
		if (this.config) return;

		const store = new IDBMap("config", {
			prefix: "scramjet",
		});

		if (store.has("config")) {
			const config = await store.get("config");
			this.config = config;
			self.$scramjet.config = config;
			self.$scramjet.codec = self.$scramjet.codecs[config.codec];
		}
	}

	async getLocalStorage(): Promise<Record<string, string>> {
		let clients = await self.clients.matchAll();
		clients = clients.filter(
			(client) =>
				client.type === "window" &&
				!new URL(client.url).pathname.startsWith(this.config.prefix)
		);

		if (clients.length === 0) throw new Error("No clients found");

		const token = this.synctoken++;
		for (const client of clients) {
			client.postMessage({
				scramjet$type: "getLocalStorage",
				scramjet$token: token,
			});
		}

		return new Promise((resolve) => {
			this.syncPool[token] = resolve;
		});
	}

	async setLocalStorage(data: Record<string, string>): Promise<void> {
		let clients = await self.clients.matchAll();
		clients = clients.filter(
			(client) =>
				client.type === "window" &&
				!new URL(client.url).pathname.startsWith(this.config.prefix)
		);

		if (clients.length === 0) throw new Error("No clients found");

		const token = this.synctoken++;
		for (const client of clients) {
			client.postMessage({
				scramjet$type: "setLocalStorage",
				scramjet$token: token,
				data,
			});
		}

		return new Promise((resolve) => {
			this.syncPool[token] = resolve;
		});
	}

	route({ request }: FetchEvent) {
		if (request.url.startsWith(location.origin + this.config.prefix))
			return true;
		else return false;
	}

	public fetch = swfetch;
}

self.ScramjetServiceWorker = ScramjetServiceWorker;

type RegisterServiceWorkerMessage = {
	scramjet$type: "registerServiceWorker";
	port: MessagePort;
	origin: string;
};

type MessageCommon = {
	scramjet$type: string;
	scramjet$token: number;
};

type MessageTypeC2W = RegisterServiceWorkerMessage;
type MessageTypeW2C = never;

// c2w: client to (service) worker
export type MessageC2W = MessageCommon & MessageTypeC2W;
export type MessageW2C = MessageCommon & MessageTypeW2C;

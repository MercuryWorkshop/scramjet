import IDBMap from "idb-map-entries";
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
		this.loadConfig();
		this.client = new self.$scramjet.shared.util.BareClient();

		this.threadpool = new ScramjetThreadpool();

		addEventListener("message", ({ data }) => {
			if (!("scramjet$type" in data)) return;

			if (data.scramjet$type === "registerServiceWorker") {
				this.serviceWorkers.push(new FakeServiceWorker(data.port));

				return;
			}

			if (!("scramjet$token" in data)) return;

			const resolve = this.syncPool[data.scramjet$token];
			delete this.syncPool[data.scramjet$token];
			if (data.scramjet$type === "getLocalStorage") {
				resolve(data.data);
			} else if (data.scramjet$type === "setLocalStorage") {
				resolve();
			}
		});
	}

	loadConfig() {
		const store = new IDBMap("config", {
			prefix: "scramjet"
		});

		if (store.has("config")) {
			store.get("config").then((config) => {
				this.config = config;
				self.$scramjet.config = config;
				self.$scramjet.codec = self.$scramjet.codecs[config.codec]
			});
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

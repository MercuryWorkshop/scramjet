import IDBMap from "@webreflection/idb-map";
import { FakeServiceWorker } from "./fakesw";
import { swfetch } from "./fetch";
import { ScramjetThreadpool } from "./threadpool";
import type BareClient from "@mercuryworkshop/bare-mux";
import { rewriteWorkers } from "../shared";

export class ScramjetServiceWorker {
	client: BareClient;
	config: typeof self.$scramjet.config;
	threadpool: ScramjetThreadpool;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	cookieStore = new self.$scramjet.shared.CookieStore();

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

			if (data.scramjet$type === "cookie") {
				this.cookieStore.setCookies([data.cookie], new URL(data.url));
				return;
			}

			// const resolve = this.syncPool[data.scramjet$token];
			// delete this.syncPool[data.scramjet$token];
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

	async fetch({ request, clientId }: FetchEvent) {
		if (new URL(request.url).pathname.startsWith("/scramjet/worker")) {
			const dataurl = new URL(request.url).searchParams.get("data");
			const res = await fetch(dataurl);
			const ab = await res.arrayBuffer();

			const origin = new URL(
				decodeURIComponent(new URL(request.url).searchParams.get("origin"))
			);

			const rewritten = rewriteWorkers(ab, new URL(origin));

			return new Response(rewritten, {
				headers: {
					"Content-Type": "application/javascript",
				},
			});
		}

		const client = await self.clients.get(clientId);

		return swfetch.call(this, request, client);
	}
}

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

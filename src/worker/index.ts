import IDBMap from "@webreflection/idb-map";
import { FakeServiceWorker } from "./fakesw";
import { swfetch } from "./fetch";
import { ScramjetThreadpool } from "./threadpool";
import type BareClient from "@mercuryworkshop/bare-mux";
import { rewriteWorkers } from "../shared";

export class ScramjetServiceWorker extends EventTarget {
	client: BareClient;
	config: typeof self.$scramjet.config;
	threadpool: ScramjetThreadpool;

	syncPool: Record<number, (val?: any) => void> = {};
	synctoken = 0;

	cookieStore = new self.$scramjet.shared.CookieStore();

	serviceWorkers: FakeServiceWorker[] = [];

	dataworkerpromises: Record<
		string,
		{ promise: Promise<string>; resolve: (v: string) => void }
	> = {};

	constructor() {
		super();
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

			if (data.scramjet$type === "dataworker") {
				if (this.dataworkerpromises[data.id]) {
					this.dataworkerpromises[data.id].resolve(data.data);
				} else {
					let resolve: (v: string) => void;
					const promise = new Promise<string>((res) => (resolve = res));
					this.dataworkerpromises[data.id] = { promise, resolve };
					resolve(data.data);
				}
			}
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
			const id = new URL(request.url).searchParams.get("id");
			const type = new URL(request.url).searchParams.get("type");

			const origin = new URL(
				decodeURIComponent(new URL(request.url).searchParams.get("origin"))
			);

			let promise = this.dataworkerpromises[id];
			if (!promise) {
				let resolve: (v: string) => void;
				promise = {
					promise: new Promise<string>((res) => (resolve = res)),
					resolve,
				};
				promise.resolve = resolve;
				this.dataworkerpromises[id] = promise;
			}

			const data = await promise.promise;
			delete this.dataworkerpromises[id];

			const rewritten = rewriteWorkers(data, type, {
				origin: new URL(origin),
				base: new URL(origin),
			});

			const headers = {
				"Content-Type": "application/javascript",
			};

			// this is broken on firefox
			if (crossOriginIsolated) {
				headers["Cross-Origin-Opener-Policy"] = "same-origin";
				headers["Cross-Origin-Embedder-Policy"] = "require-corp";
			}

			return new Response(rewritten, {
				headers,
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

type DataWorkerMessage = {
	scramjet$type: "dataworker";
	data: string;
	id: string;
};

type MessageCommon = {
	scramjet$type: string;
	scramjet$token: number;
};

type MessageTypeC2W =
	| RegisterServiceWorkerMessage
	| CookieMessage
	| DataWorkerMessage;
type MessageTypeW2C = CookieMessage;

// c2w: client to (service) worker
export type MessageC2W = MessageCommon & MessageTypeC2W;
export type MessageW2C = MessageCommon & MessageTypeW2C;

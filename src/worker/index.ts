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

	constructor(config = self.$scramjet.config) {
		this.client = new self.$scramjet.shared.util.BareClient();
		if (!config.prefix) config.prefix = "/scramjet/";
		this.config = config;

		this.threadpool = new ScramjetThreadpool();

	}

	route({ request }: FetchEvent) {
		if (request.url.startsWith(location.origin + this.config.prefix))
			return true;
		else return false;
	}

	public fetch = swfetch;
};


self.ScramjetServiceWorker = ScramjetServiceWorker;

import IDBMap from "@webreflection/idb-map";
import { ScramjetConfig } from "../types";
import { Codec } from "../codecs";

export class ScramjetController {
	config: ScramjetConfig;
	private store: IDBMap;
	codec: Codec;

	constructor(config: ScramjetConfig) {
		const defaultConfig = {
			prefix: "/scramjet/",
			codec: "plain",
			wrapfn: "$scramjet$wrap",
			trysetfn: "$scramjet$tryset",
			importfn: "$scramjet$import",
			rewritefn: "$scramjet$rewrite",
			metafn: "$scramjet$meta",
			wasm: "/scramjet.wasm.js",
			shared: "/scramjet.shared.js",
			worker: "/scramjet.worker.js",
			thread: "/scramjet.thread.js",
			client: "/scramjet.client.js",
			codecs: "/scramjet.codecs.js",
		};

		this.config = Object.assign({}, defaultConfig, config);
	}

	async init(serviceWorkerPath: string): Promise<ServiceWorkerRegistration> {
		await import(/* webpackIgnore: true */ this.config.codecs);
		this.codec = self.$scramjet.codecs[this.config.codec];

		this.store = new IDBMap("config", {
			prefix: "scramjet",
		});
		await this.#saveConfig();

		const reg = await navigator.serviceWorker.register(serviceWorkerPath, {
			scope: this.config.prefix,
		});
		dbg.log("service worker registered");

		return reg;
	}

	createFrame(frame?: HTMLIFrameElement): ScramjetFrame {
		if (!frame) {
			frame = document.createElement("iframe");
		}

		return new ScramjetFrame(this, frame);
	}

	encodeUrl(url: string | URL): string {
		if (url instanceof URL) url = url.toString();

		return this.config.prefix + this.codec.encode(url);
	}

	async #saveConfig() {
		this.store.set("config", this.config);
	}

	async modifyConfig(config: ScramjetConfig) {
		this.config = Object.assign({}, this.config, config);
		this.codec = self.$scramjet.codecs[this.config.codec];

		await this.#saveConfig();
	}
}

class ScramjetFrame extends EventTarget {
	static SCRAMJETFRAME = Symbol.for("scramjet frame handle");
	constructor(
		private controller: ScramjetController,
		public frame: HTMLIFrameElement
	) {
		super();
		frame[ScramjetFrame.SCRAMJETFRAME] = this;
	}

	go(url: string | URL) {
		if (url instanceof URL) url = url.toString();

		dbg.log("navigated to", url);

		this.frame.src = this.controller.encodeUrl(url);
	}

	back() {
		this.frame.contentWindow?.history.back();
	}

	forward() {
		this.frame.contentWindow?.history.forward();
	}
}

window.ScramjetController = ScramjetController;

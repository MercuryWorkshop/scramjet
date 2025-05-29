import { ScramjetConfig, ScramjetInitConfig } from "../types";
import { ScramjetFrame } from "./frame";
import { $scramjet, loadCodecs } from "../scramjet";

export class ScramjetController {
	private db: IDBDatabase;

	constructor(config: Partial<ScramjetInitConfig>) {
		// sane ish defaults
		const defaultConfig: ScramjetInitConfig = {
			prefix: "/scramjet/",
			globals: {
				wrapfn: "$scramjet$wrap",
				wrapthisfn: "$scramjet$wrapthis",
				trysetfn: "$scramjet$tryset",
				importfn: "$scramjet$import",
				rewritefn: "$scramjet$rewrite",
				metafn: "$scramjet$meta",
				setrealmfn: "$scramjet$setrealm",
				pushsourcemapfn: "$scramjet$pushsourcemap",
			},
			files: {
				wasm: "/scramjet.wasm.js",
				shared: "/scramjet.shared.js",
				worker: "/scramjet.worker.js",
				client: "/scramjet.client.js",
				sync: "/scramjet.sync.js",
			},
			flags: {
				serviceworkers: false,
				syncxhr: false,
				naiiveRewriter: false,
				strictRewrites: true,
				rewriterLogs: false,
				captureErrors: true,
				cleanErrors: false,
				scramitize: false,
				sourcemaps: true,
			},
			siteFlags: {},
			codec: {
				encode: (url: string) => {
					if (!url) return url;

					return encodeURIComponent(url);
				},
				decode: (url: string) => {
					if (!url) return url;

					return decodeURIComponent(url);
				},
			},
		};

		const deepMerge = (target: any, source: any): any => {
			for (const key in source) {
				if (source[key] instanceof Object && key in target) {
					Object.assign(source[key], deepMerge(target[key], source[key]));
				}
			}

			return Object.assign(target || {}, source);
		};

		const newConfig = deepMerge(defaultConfig, config);
		newConfig.codec.encode = newConfig.codec.encode.toString();
		newConfig.codec.decode = newConfig.codec.decode.toString();
		$scramjet.config = newConfig as ScramjetConfig;
	}

	async init(): Promise<void> {
		loadCodecs();

		await this.openIDB();
		navigator.serviceWorker.controller?.postMessage({
			scramjet$type: "loadConfig",
			config: $scramjet.config,
		});
		dbg.log("config loaded");
	}

	createFrame(frame?: HTMLIFrameElement): ScramjetFrame {
		if (!frame) {
			frame = document.createElement("iframe");
		}

		return new ScramjetFrame(this, frame);
	}

	encodeUrl(url: string | URL): string {
		if (url instanceof URL) url = url.toString();

		return $scramjet.config.prefix + $scramjet.codec.encode(url);
	}

	decodeUrl(url: string | URL) {
		if (url instanceof URL) url = url.toString();

		return $scramjet.codec.decode(url);
	}

	async openIDB(): Promise<IDBDatabase> {
		const db = indexedDB.open("$scramjet", 1);

		return new Promise<IDBDatabase>((resolve, reject) => {
			db.onsuccess = async () => {
				this.db = db.result;
				await this.#saveConfig();
				resolve(db.result);
			};
			db.onupgradeneeded = () => {
				const res = db.result;
				if (!res.objectStoreNames.contains("config")) {
					res.createObjectStore("config");
				}
				if (!res.objectStoreNames.contains("cookies")) {
					res.createObjectStore("cookies");
				}
			};
			db.onerror = () => reject(db.error);
		});
	}

	async #saveConfig() {
		if (!this.db) {
			console.error("Store not ready!");

			return;
		}
		const tx = this.db.transaction("config", "readwrite");
		const store = tx.objectStore("config");
		const req = store.put($scramjet.config, "config");

		return new Promise((resolve, reject) => {
			req.onsuccess = resolve;
			req.onerror = reject;
		});
	}

	async modifyConfig(config: ScramjetConfig) {
		$scramjet.config = Object.assign({}, $scramjet.config, config);
		loadCodecs();

		await this.#saveConfig();
	}
}

window.ScramjetController = ScramjetController;

import { ScramjetConfig } from "../types";
import { ScramjetFrame } from "./frame";
import { $scramjet, loadCodecs } from "../scramjet";

export class ScramjetController {
	private store: IDBDatabase;

	constructor(config: Partial<ScramjetConfig>) {
		// sane ish defaults
		const defaultConfig: Partial<ScramjetConfig> = {
			prefix: "/scramjet/",
			globals: {
				wrapfn: "$scramjet$wrap",
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
			defaultFlags: {
				serviceworkers: false,
				naiiveRewriter: false,
				captureErrors: true,
				syncxhr: false,
				cleanerrors: false,
				scramitize: false,
				sourcemaps: false,
			},
			siteFlags: {},
			codec: {
				encode: `if (!url) return url;
					return encodeURIComponent(url);`,
				decode: `if (!url) return url;
					return decodeURIComponent(url);`,
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

		$scramjet.config = deepMerge(defaultConfig, config);
	}

	async init(serviceWorkerPath: string): Promise<ServiceWorkerRegistration> {
		loadCodecs();

		await this.openIDB();

		const reg = await navigator.serviceWorker.register(serviceWorkerPath);
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

		return $scramjet.config.prefix + $scramjet.codec.encode(url);
	}

	async openIDB(): Promise<IDBDatabase> {
		const db = indexedDB.open("$scramjet", 1);

		return new Promise<IDBDatabase>((resolve, reject) => {
			db.onsuccess = async () => {
				this.store = db.result;
				await this.#saveConfig();
				resolve(db.result);
			};
			db.onupgradeneeded = () => {
				const db2 = db.result;
				if (!db2.objectStoreNames.contains("config")) {
					db2.createObjectStore("config");
				}
			};
			db.onerror = () => reject(db.error);
		});
	}

	async #saveConfig() {
		if (!this.store) {
			console.error("Store not ready!");

			return;
		}
		const tx = this.store.transaction("config", "readwrite");
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

import {
	codecDecode,
	codecEncode,
	config,
	loadCodecs,
	setConfig,
} from "@/shared/index";
import { ScramjetConfig, ScramjetInitConfig, ScramjetDB } from "@/types";
import { ScramjetFrame } from "@/controller/frame";
import { MessageW2C } from "@/worker";
import { openDB, IDBPDatabase } from "idb";
import {
	ScramjetEvents,
	ScramjetGlobalDownloadEvent,
	ScramjetGlobalEvent,
	ScramjetGlobalEvents,
} from "@client/events";

export class ScramjetController extends EventTarget {
	private db: IDBPDatabase<ScramjetDB>;

	constructor(config: Partial<ScramjetInitConfig>) {
		super();
		// sane ish defaults
		const defaultConfig: ScramjetInitConfig = {
			// wisp: "/wisp/",
			prefix: "/scramjet/",
			globals: {
				wrapfn: "$scramjet$wrap",
				wrappropertybase: "$scramjet__",
				wrappropertyfn: "$scramjet$prop",
				cleanrestfn: "$scramjet$clean",
				importfn: "$scramjet$import",
				rewritefn: "$scramjet$rewrite",
				metafn: "$scramjet$meta",
				setrealmfn: "$scramjet$setrealm",
				pushsourcemapfn: "$scramjet$pushsourcemap",
				trysetfn: "$scramjet$tryset",
				templocid: "$scramjet$temploc",
				tempunusedid: "$scramjet$tempunused",
			},
			files: {
				wasm: "/scramjet.wasm.wasm",
				all: "/scramjet.all.js",
				sync: "/scramjet.sync.js",
			},
			flags: {
				serviceworkers: false,
				syncxhr: false,
				strictRewrites: true,
				rewriterLogs: false,
				captureErrors: true,
				cleanErrors: false,
				scramitize: false,
				sourcemaps: true,
				destructureRewrites: false,
				interceptDownloads: false,
				allowInvalidJs: true,
				allowFailedIntercepts: true,
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
		setConfig(newConfig as ScramjetConfig);
	}

	async init(): Promise<void> {
		loadCodecs();

		await this.openIDB();
		navigator.serviceWorker.controller?.postMessage({
			scramjet$type: "loadConfig",
			config,
		});
		dbg.log("config loaded");

		navigator.serviceWorker.addEventListener("message", (e) => {
			if (!("scramjet$type" in e.data)) return;
			const data: MessageW2C = e.data;

			if (data.scramjet$type === "download") {
				this.dispatchEvent(new ScramjetGlobalDownloadEvent(data.download));
			}
		});
	}

	createFrame(frame?: HTMLIFrameElement): ScramjetFrame {
		if (!frame) {
			frame = document.createElement("iframe");
		}

		return new ScramjetFrame(this, frame);
	}

	encodeUrl(url: string | URL): string {
		if (typeof url === "string") url = new URL(url);

		if (url.protocol != "http:" && url.protocol != "https:") {
			return url.href;
		}

		const encodedHash = codecEncode(url.hash.slice(1));
		const realHash = encodedHash ? "#" + encodedHash : "";
		url.hash = "";

		return config.prefix + codecEncode(url.href) + realHash;
	}

	decodeUrl(url: string | URL) {
		if (url instanceof URL) url = url.toString();
		const prefixed = location.origin + config.prefix;

		return codecDecode(url.slice(prefixed.length));
	}

	async openIDB(): Promise<IDBPDatabase<ScramjetDB>> {
		const db = await openDB<ScramjetDB>("$scramjet", 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("config")) {
					db.createObjectStore("config");
				}
				if (!db.objectStoreNames.contains("cookies")) {
					db.createObjectStore("cookies");
				}
				if (!db.objectStoreNames.contains("redirectTrackers")) {
					db.createObjectStore("redirectTrackers");
				}
				if (!db.objectStoreNames.contains("referrerPolicies")) {
					db.createObjectStore("referrerPolicies");
				}
				if (!db.objectStoreNames.contains("publicSuffixList")) {
					db.createObjectStore("publicSuffixList");
				}
			},
		});

		this.db = db;
		await this.#saveConfig();
		return db;
	}

	async #saveConfig() {
		if (!this.db) {
			console.error("Store not ready!");

			return;
		}
		await this.db.put("config", config, "config");
	}

	async modifyConfig(newconfig: Partial<ScramjetInitConfig>) {
		setConfig(Object.assign({}, config, newconfig));
		loadCodecs();

		await this.#saveConfig();
		navigator.serviceWorker.controller?.postMessage({
			scramjet$type: "loadConfig",
			config,
		});
	}

	addEventListener<K extends keyof ScramjetGlobalEvents>(
		type: K,
		listener: (event: ScramjetGlobalEvents[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener as EventListener, options);
	}
}

/**
 * @fileoverview Contains the controller class.
 */

import {
	codecDecode,
	codecEncode,
	config,
	loadCodecs,
	setConfig,
} from "@/shared/index";
import { ScramjetConfig, ScramjetInitConfig } from "@/types";
import { ScramjetFrame } from "@/controller/frame";
import { MessageW2C } from "@/worker";
import {
	ScramjetEvents,
	ScramjetGlobalDownloadEvent,
	ScramjetGlobalEvent,
	ScramjetGlobalEvents,
} from "@client/events";

/**
 * Controller class for managing behavior in the Scramjet Service Worker.
 * You should create this class from the factory `$scramjetLoadController`
 * This handles proxified Scramjet iframe creations and let's you configure how Scramjet intercepts things.
 * A lot of these are lower level, and some of these APIs can be avoided by using {@link ScramjetController.createFrame}.
 *
 * @example
 * ```typescript
 * const { ScramjetController } = $scramjetLoadController();
 *
 * const scramjet = new ScramjetController({
 *   prefix: "/scramjet/",
 *   files: {
 *     wasm: "/scram/scramjet.wasm.wasm",
 *     all: "/scram/scramjet.all.js",
 *     sync: "/scram/scramjet.sync.js",
 *   }
 * });
 *
 * await scramjet.init();
 *
 * const frame = scramjet.createFrame();
 * document.body.appendChild(frame.frame);
 * frame.go("https://example.com");
 * ```
 */
export class ScramjetController extends EventTarget {
	private db: IDBDatabase;

	/**
	 * Creates an instance with config overrides
	 *
	 * {@includeCode ./index.ts#defaultconfig}
	 *
	 * @example
	 * ```typescript
	 * // Initialize the ScramjetController with recommended defaults
	 * const scramjet = new ScramjetController({
	 *   prefix: "/scramjet/",
	 *   files: {
	 *     wasm: "/scram/scramjet.wasm.wasm",
	 *     all: "/scram/scramjet.all.js",
	 *     sync: "/scram/scramjet.sync.js",
	 *   }
	 * });
	 * ```
	 *
	 * @param config Configuration options for Scramjet
	 */
	constructor(config: Partial<ScramjetInitConfig>) {
		super();
		// sane ish defaults
		// #region defaultconfig
		const defaultConfig: ScramjetInitConfig = {
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
		// #endregion defaultconfig

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

	/**
	 * Initializes Scramjet.
	 * This sends the current config to the service worker and initializes the IndexedDB tables.
	 * Must be called after creating the controller and before using Scramjet Frames.
	 *
	 * @example
	 * ```typescript
	 * const { ScramjetController } = $scramjetLoadController();
	 * const scramjet = new ScramjetController({
	 *   prefix: "/scramjet/",
	 *   files: {
	 *     all: "/scram/scramjet.all.js"
	 *   }
	 * });
	 *
	 * await scramjet.init();
	 *
	 * // Initialize a Scramjet Frame and goes to a site
	 * const frame = scramjet.createFrame();
	 * frame.go("https://example.com");
	 * ```
	 */
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

	/**
	 * Factory method that creates a `ScramjetFrame` to be integrated into your application.
	 *
	 * @example
	 * ```typescript
	 * const frame = scramjet.createFrame();
	 * document.body.appendChild(frame.frame);
	 *
	 * const iframe = document.createElement("iframe");
	 * const frame = scramjet.createFrame(iframe);
	 * document.body.appendChild(frame.frame);
	 *
	 * // Navigate to a proxified URL
	 * frame.go("https://example.com");
	 *
	 * // Listen for proxified URL changes
	 * frame.addEventListener("urlchange", (e) => {
	 *   console.log("New URL:", e.url);
	 * });
	 * ```
	 *
	 * @param frame Existing iframe element to use.
	 * @returns A ScramjetFrame instance.
	 */
	createFrame(frame?: HTMLIFrameElement): ScramjetFrame {
		if (!frame) {
			frame = document.createElement("iframe");
		}

		return new ScramjetFrame(this, frame);
	}

	/**
	 * Encodes a proxy URL into a real URL.
	 *
	 * @param url A fully complete URL.
	 * @returns The encoded URL.
	 */
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

	/**
	 * Decodes a real URL into its proxy URL.
	 *
	 * @param url Real URL
	 * @returns Its proxy URL
	 */
	decodeUrl(url: string | URL) {
		if (url instanceof URL) url = url.toString();
		const prefixed = location.origin + config.prefix;

		return codecDecode(url.slice(prefixed.length));
	}

	/**
	 * Opens Scramjet's IndexedDB database and initializes its required object stores if they don't yet exist.
	 * This is only to be used internally by the {@link ScramjetController.constructor | constructor}.
	 * As a proxy site developer, you do not need to interact with this directly.
	 *
	 * @returns A Promise to either return the initialized IndexedDB or to handle IndexedDB rejections.
	 */
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
				if (!res.objectStoreNames.contains("redirectTrackers")) {
					res.createObjectStore("redirectTrackers");
				}
				if (!res.objectStoreNames.contains("referrerPolicies")) {
					res.createObjectStore("referrerPolicies");
				}
				if (!res.objectStoreNames.contains("publicSuffixList")) {
					res.createObjectStore("publicSuffixList");
				}
			};
			db.onerror = () => reject(db.error);
		});
	}

	/**
	 * Persists the current config in IndexedDB.
	 *
	 * @returns The IndexedDB result.
	 */
	async #saveConfig() {
		if (!this.db) {
			console.error("Store not ready!");

			return;
		}
		const tx = this.db.transaction("config", "readwrite");
		const store = tx.objectStore("config");
		const req = store.put(config, "config");

		return new Promise((resolve, reject) => {
			req.onsuccess = resolve;
			req.onerror = reject;
		});
	}

	/**
	 * Dynamically updates the Scramjet config on the Service Worker.
	 */
	async modifyConfig(newconfig: Partial<ScramjetInitConfig>) {
		setConfig(Object.assign({}, config, newconfig));
		loadCodecs();

		await this.#saveConfig();
		navigator.serviceWorker.controller?.postMessage({
			scramjet$type: "loadConfig",
			config,
		});
	}

	/**
	 * Adds an event listener for Scramjet's lower level events.
	 * Binds event listeners to listen for proxified navigation events in Scramjet.
	 *
	 * @param type Type of event to listen for.
	 * @param listener Event listener to dispatch.
	 * @param options Options for the event listener.
	 */
	addEventListener<K extends keyof ScramjetGlobalEvents>(
		type: K,
		listener: (event: ScramjetGlobalEvents[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener as EventListener, options);
	}
}

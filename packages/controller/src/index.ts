import { type MethodsDefinition, RpcHelper } from "@mercuryworkshop/rpc";
import {
	BareResponse,
	type ProxyTransport,
} from "@mercuryworkshop/proxy-transports";
import { deepmerge } from "@fastify/deepmerge";
import {
	CookieJar,
	defaultConfig as scramjetDefaultConfig,
	rewriteUrl,
	ScramjetFetchHandler,
	ScramjetHeaders,
	setWasm,
	Tap,
	type CookieSyncOptions,
	type FetchHooks,
	type ScramjetConfig,
	type ScramjetContext,
	type ScramjetInterface,
	type TrackedHistoryState,
	Plugin,
} from "@mercuryworkshop/scramjet";
import { CONTROLLERFRAME } from "./symbols";
import type {
	FrameInitHooks,
	SerializedCookieSyncEntry,
	TransportToController,
	Controllerbound,
	ControllerToTransport,
	SWbound,
	WebSocketMessage,
	FrameErrorHooks,
} from "./types";
import { assertRuntimeScramjetVersion } from "./version";

export { VERSION } from "./version";
export { assertRuntimeScramjetVersion } from "./version";

export type Config = {
	prefix: string;
	scramjetPath: string;
	injectPath: string;
	wasmPath: string;
	virtualWasmPath: string;
	codec: Record<"encode" | "decode", (input: string) => string>;
};

export const config: Config = {
	prefix: "/~/sj/",
	scramjetPath: "/scramjet/scramjet.js",
	injectPath: "/controller/controller.inject.js",
	wasmPath: "/scramjet/scramjet.wasm",
	virtualWasmPath: "scramjet.wasm.js",
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

const scramjetConfig: Partial<ScramjetConfig> = {
	flags: {
		...scramjetDefaultConfig.flags,
		allowFailedIntercepts: true,
	},
	maskedfiles: ["inject.js", "scramjet.wasm.js"],
};

type PersistedCookieState = {
	updatedAt: number;
	cookies: string;
};

export class ManagedPlugin extends Plugin {
	frame: Frame = null!;
	dependencies: string[] = [];
	constructor(name: string, dependencies: string[]) {
		super(name);
		this.dependencies = dependencies;
	}

	install(frame: Frame): void {
		this.frame = frame;
	}
}

const COOKIE_DB_NAME = "__scramjet_controller";
const COOKIE_STORE_NAME = "state";
const COOKIE_STATE_KEY = "cookies";
const BROADCASTCHANNEL_NAME = "__scramjet_controller_channel";

let cookieDbPromise: Promise<IDBDatabase> | null = null;

function parsePersistedCookieState(
	value: unknown
): PersistedCookieState | null {
	if (
		typeof value !== "object" ||
		value === null ||
		typeof (value as PersistedCookieState).updatedAt !== "number" ||
		!Number.isFinite((value as PersistedCookieState).updatedAt) ||
		typeof (value as PersistedCookieState).cookies !== "string"
	) {
		return null;
	}

	return value as PersistedCookieState;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"));
	});
}

function openCookieDatabase(): Promise<IDBDatabase> {
	if (cookieDbPromise) {
		return cookieDbPromise;
	}

	cookieDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(COOKIE_DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(COOKIE_STORE_NAME)) {
				db.createObjectStore(COOKIE_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Failed to open cookie database"));
	});

	return cookieDbPromise;
}

async function readCookieState(): Promise<PersistedCookieState | null> {
	try {
		const db = await openCookieDatabase();
		const transaction = db.transaction(COOKIE_STORE_NAME, "readonly");
		const store = transaction.objectStore(COOKIE_STORE_NAME);
		const value = await requestToPromise(store.get(COOKIE_STATE_KEY));
		await transactionToPromise(transaction);
		return parsePersistedCookieState(value);
	} catch (error) {
		console.error("Failed to read persisted controller cookies:", error);
		return null;
	}
}

async function writeCookieState(
	cookies: string,
	currentUpdatedAt: number
): Promise<number> {
	try {
		const db = await openCookieDatabase();
		const transaction = db.transaction(COOKIE_STORE_NAME, "readwrite");
		const store = transaction.objectStore(COOKIE_STORE_NAME);
		const existing = parsePersistedCookieState(
			await requestToPromise(store.get(COOKIE_STATE_KEY))
		);
		const updatedAt = Math.max(
			Date.now(),
			currentUpdatedAt + 1,
			(existing?.updatedAt ?? 0) + 1
		);
		const state: PersistedCookieState = {
			updatedAt,
			cookies,
		};
		store.put(state, COOKIE_STATE_KEY);
		await transactionToPromise(transaction);
		return updatedAt;
	} catch (error) {
		console.error("Failed to persist controller cookies:", error);
		return currentUpdatedAt;
	}
}

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

const deepMerge = deepmerge();

type ControllerInit = {
	serviceworker: ServiceWorker;
	transport: ProxyTransport;
	config?: Partial<Config>;
	scramjetConfig?: Partial<ScramjetConfig>;
};

type FrameOptions = {
	plugins: ManagedPlugin[];
};

export class Controller {
	id: string;
	config: Config;
	scramjetConfig: ScramjetConfig;
	prefix: string;
	cookieJar = new CookieJar();
	frames: Frame[] = [];
	serviceWorkerController: ServiceWorker;
	guardServiceWorkerRevive = true;

	private ready: Promise<void>;
	private readyResolve!: () => void;
	public isReady: boolean = false;
	rpc: RpcHelper<Controllerbound, SWbound>;
	private port: MessagePort | null = null;

	transport: ProxyTransport;
	private cookieUpdatedAt = 0;
	private cookieSyncPromise: Promise<void> | null = null;
	private cookieSyncDirty = true;
	private cookieSyncChannel = new BroadcastChannel(BROADCASTCHANNEL_NAME);

	private wasmAlreadyFetched = false;
	private wasmPayload: string | null = null;
	private onTabChannelMessage: (e: MessageEvent) => void = (e) => {
		this.rpc.recieve(e.data);
	};
	private onCookieSyncMessage = (event: MessageEvent) => {
		const updatedAt =
			typeof event.data === "object" && event.data !== null
				? (event.data as { updatedAt?: unknown }).updatedAt
				: undefined;
		if (typeof updatedAt !== "number" || updatedAt <= this.cookieUpdatedAt) {
			return;
		}

		this.cookieSyncDirty = true;
		void this.loadSavedCookies();
	};

	private async loadScramjetWasm() {
		if (this.wasmAlreadyFetched) {
			return;
		}

		const resp = await fetch(this.config.wasmPath);
		setWasm(await resp.arrayBuffer());
		this.wasmAlreadyFetched = true;
	}

	private methods: MethodsDefinition<Controllerbound> = {
		ready: async () => {
			this.readyResolve();
			setTimeout(() => {
				this.guardServiceWorkerRevive = false;
			}, 5000);
		},
		request: async (data) => {
			const path = new URL(data.rawUrl).pathname;
			const frame = this.frames.find((f) => path.startsWith(f.prefix));
			if (!frame) throw new Error("No frame found for request");
			try {
				// doesn't actually *load* every request, but hold up requests until the promise finishes
				await this.loadSavedCookies();

				if (path === frame.prefix + this.config.virtualWasmPath) {
					if (!this.wasmPayload) {
						const resp = await fetch(this.config.wasmPath);
						const buf = await resp.arrayBuffer();
						const b64 = btoa(
							new Uint8Array(buf)
								.reduce(
									(data, byte) => (data.push(String.fromCharCode(byte)), data),
									[] as any
								)
								.join("")
						);

						this.wasmPayload = `self.WASM = '${b64}';`;
					}

					return [
						{
							body: this.wasmPayload,
							status: 200,
							statusText: "OK",
							headers: [["Content-Type", "application/javascript"]],
						},
						[],
					];
				}

				const sjheaders = ScramjetHeaders.fromRawHeaders(data.initialHeaders);

				const fetchresponse = await frame.fetchHandler.handleFetch({
					initialHeaders: sjheaders,
					rawClientUrl: data.rawClientUrl
						? new URL(data.rawClientUrl)
						: undefined,
					rawUrl: new URL(data.rawUrl),
					rawReferrer: data.rawReferrer,
					rawDestination: data.destination,
					method: data.method,
					mode: data.mode,
					referrer: data.referrer,
					body: data.body,
					cache: data.cache,
					clientId: data.clientId,
				});

				return [
					{
						body: fetchresponse.body,
						status: fetchresponse.status,
						statusText: fetchresponse.statusText,
						headers: fetchresponse.headers.toRawHeaders(),
					},
					fetchresponse.body instanceof ReadableStream ||
					fetchresponse.body instanceof ArrayBuffer
						? [fetchresponse.body]
						: [],
				];
			} catch (e) {
				const reqcontext: typeof frame.hooks.error.request.context = {
					rawrequest: data,
					error: e,
				};
				const reqprops: typeof frame.hooks.error.request.props = {
					setResponse: undefined,
					suppressError: false,
				};
				await Tap.dispatch(frame.hooks.error.request, reqcontext, reqprops);
				if (!reqprops.suppressError) {
					console.error("Error in controller request handler:", e);
				}
				if (reqprops.setResponse) {
					return [reqprops.setResponse, []];
				}
				throw e;
			}
		},
		initRemoteTransport: async (port) => {
			const rpc = new RpcHelper<TransportToController, ControllerToTransport>(
				{
					request: async ({ remote, method, body, headers }) => {
						const response = await this.transport.request(
							new URL(remote),
							method,
							body,
							headers,
							undefined
						);
						return [response, [response.body]];
					},
					sendSetCookie: async ({ cookies, options }) => {
						await this.loadSavedCookies(true);
						if (options?.clear) {
							this.cookieJar.clear();
						}
						this.applyCookieSyncEntries(cookies);
						await this.persistCookies();
						await this.propagateCookieSync(cookies, options);
					},
					connect: async ({ url, protocols, requestHeaders, port }) => {
						let resolve: (arg: TransportToController["connect"][1]) => void;
						const promise = new Promise<TransportToController["connect"][1]>(
							(res) => (resolve = res)
						);
						const [send, close] = this.transport.connect(
							new URL(url),
							protocols,
							requestHeaders,
							(protocol, extensions) => {
								resolve({
									result: "success",
									protocol: protocol,
									extensions: extensions,
								});
							},
							(data) => {
								port.postMessage(
									{
										type: "data",
										data: data,
									} as WebSocketMessage,
									data instanceof ArrayBuffer ? [data] : []
								);
							},
							(close, reason) => {
								port.postMessage({
									type: "close",
									code: close,
									reason: reason,
								} as WebSocketMessage);
							},
							(error) => {
								resolve({
									result: "failure",
									error: error,
								});
							}
						);
						port.onmessageerror = (ev) => {
							console.error(
								"Transport port messageerror (this should never happen!)",
								ev
							);
						};
						port.onmessage = ({ data }: { data: WebSocketMessage }) => {
							if (data.type === "data") {
								send(data.data);
							} else if (data.type === "close") {
								close(data.code, data.reason);
							}
						};

						return [await promise, []];
					},
				},
				"transport",
				(data, transfer) => port.postMessage(data, transfer)
			);
			port.onmessageerror = (ev) => {
				console.error(
					"Transport port messageerror (this should never happen!)",
					ev
				);
			};
			port.onmessage = (e) => {
				rpc.recieve(e.data);
			};
			rpc.call("ready", undefined, []);
		},
	};

	constructor(public init: ControllerInit) {
		assertRuntimeScramjetVersion();
		this.id = makeId();
		this.config = deepMerge(config, init.config || {}) as Config;
		this.scramjetConfig = deepMerge(scramjetConfig, scramjetDefaultConfig);
		this.scramjetConfig = deepMerge(
			this.scramjetConfig,
			init.scramjetConfig || {}
		) as ScramjetConfig;
		this.prefix = this.config.prefix + this.id + "/";
		this.serviceWorkerController = init.serviceworker;

		this.ready = Promise.all([
			new Promise<void>((resolve) => {
				this.readyResolve = resolve;
			}),
			this.loadScramjetWasm(),
			this.loadSavedCookies(true),
		]).then(() => undefined);

		this.rpc = new RpcHelper<Controllerbound, SWbound>(
			this.methods,
			"tabchannel-" + this.id,
			(data, transfer) => {
				if (!this.port) {
					throw new Error("Port not found");
				}
				this.port.postMessage(data, transfer);
			}
		);
		this.transport = init.transport;

		this.cookieSyncChannel.addEventListener(
			"message",
			this.onCookieSyncMessage
		);
		this.setupMessagePort();

		navigator.serviceWorker.addEventListener("message", (e) => {
			if (
				e.data?.$controller$setCookie &&
				typeof e.data.$controller$setCookie === "object"
			) {
				const payload = e.data.$controller$setCookie as {
					cookies?: SerializedCookieSyncEntry[];
					options?: CookieSyncOptions;
					id?: string;
				};

				if (payload.options?.clear) {
					this.cookieJar.clear();
				}
				this.applyCookieSyncEntries(payload.cookies);

				if (typeof payload.id === "string") {
					this.serviceWorkerController.postMessage({
						$sw$setCookieDone: {
							id: payload.id,
						},
					});
				}

				return;
			}

			if (e.data.$controller$swrevive) {
				// if we just spawned the service worker, it will send this even though it's not actually dead
				// TODO: pretty jank, fix at some point
				if (this.guardServiceWorkerRevive) {
					return;
				}
				this.setupMessagePort();
			}
		});
	}

	private setupMessagePort() {
		if (this.port) {
			this.port.removeEventListener("message", this.onTabChannelMessage);
			try {
				this.port.close();
			} catch {
				// ignore
			}
			this.port = null;
		}

		const channel = new MessageChannel();
		this.port = channel.port1;
		this.port.addEventListener("message", this.onTabChannelMessage);
		this.port.start();

		this.serviceWorkerController.postMessage(
			{
				$controller$init: {
					prefix: this.prefix,
					id: this.id,
				},
			},
			[channel.port2]
		);
	}

	// TODO: should this be a method on the cookie jar?
	private applyCookieSyncEntries(
		cookies: SerializedCookieSyncEntry[] | undefined
	) {
		if (!Array.isArray(cookies)) {
			return;
		}

		for (const entry of cookies) {
			if (typeof entry?.url !== "string" || typeof entry.cookie !== "string") {
				continue;
			}

			this.cookieJar.setCookies(entry.cookie, new URL(entry.url));
		}
	}

	async propagateCookieSync(
		cookies: SerializedCookieSyncEntry[],
		options: CookieSyncOptions = {}
	): Promise<void> {
		if (!this.port) {
			return;
		}

		await this.rpc.call("sendSetCookie", {
			cookies,
			options,
		});
	}

	private async loadSavedCookies(force = false): Promise<void> {
		if (!force && !this.cookieSyncDirty) {
			return;
		}

		if (this.cookieSyncPromise) {
			return this.cookieSyncPromise;
		}

		this.cookieSyncPromise = (async () => {
			const persisted = await readCookieState();
			if (persisted && persisted.updatedAt > this.cookieUpdatedAt) {
				this.cookieJar.load(persisted.cookies);
				this.cookieUpdatedAt = persisted.updatedAt;
			}
			this.cookieSyncDirty = false;
		})().finally(() => {
			this.cookieSyncPromise = null;
		});

		return this.cookieSyncPromise;
	}

	async persistCookies(): Promise<void> {
		const updatedAt = await writeCookieState(
			this.cookieJar.dump(),
			this.cookieUpdatedAt
		);
		if (updatedAt <= this.cookieUpdatedAt) {
			return;
		}

		this.cookieUpdatedAt = updatedAt;
		this.cookieSyncDirty = false;
		this.cookieSyncChannel.postMessage({
			updatedAt,
		});
	}

	setTransport(transport: ProxyTransport) {
		this.transport = transport;
		for (const frame of this.frames) {
			frame.controller.transport = transport;
			frame.fetchHandler.client.transport = transport;
		}
	}

	createFrame(element?: HTMLIFrameElement, options: FrameOptions = {}): Frame {
		if (!this.ready) {
			throw new Error(
				"Controller is not ready! Try awaiting controller.wait()"
			);
		}
		element ??= document.createElement("iframe");
		const frame = new Frame(this, element, options);
		this.frames.push(frame);
		return frame;
	}

	async wait(): Promise<void> {
		await this.ready;
	}
}

function base64Encode(text: string) {
	return btoa(
		new TextEncoder()
			.encode(text)
			.reduce(
				(data, byte) => (data.push(String.fromCharCode(byte)), data),
				[] as any
			)
			.join("")
	);
}

function yieldGetInjectScripts(
	config: Config,
	sjconfig: ScramjetConfig,
	prefix: URL,
	cookieJar: CookieJar,
	codecEncode: (input: string) => string,
	codecDecode: (input: string) => string
) {
	const getInjectScripts: ScramjetInterface["getInjectScripts"] = (
		meta,
		handler,
		htmlcontext,
		script
	) => {
		function base64Encode(text: string) {
			return btoa(
				new TextEncoder()
					.encode(text)
					.reduce(
						(data, byte) => (data.push(String.fromCharCode(byte)), data),
						[] as any
					)
					.join("")
			);
		}
		return [
			script(config.scramjetPath),
			script(prefix.href + config.virtualWasmPath),
			script(config.injectPath),
			script(
				"data:text/javascript;charset=utf-8;base64," +
					base64Encode(`
					document.querySelectorAll("script[scramjet-injected]").forEach(script => script.remove());
					$scramjetController.load({
						config: ${JSON.stringify(config)},
						sjconfig: ${JSON.stringify(sjconfig)},
						prefix: new URL("${prefix.href}"),
						cookies: ${JSON.stringify(cookieJar.dump())},
						yieldGetInjectScripts: ${yieldGetInjectScripts.toString()},
						codecEncode: ${codecEncode.toString()},
						codecDecode: ${codecDecode.toString()},
						initHeaders: ${JSON.stringify(htmlcontext.headers ?? [])},
						history: ${JSON.stringify(htmlcontext.history ?? [])},
					})
				`)
			),
		];
	};
	return getInjectScripts;
}

export class Frame {
	id: string;
	prefix: string;
	fetchHandler: ScramjetFetchHandler;
	hooks: {
		fetch: FetchHooks;
		init: FrameInitHooks;
		error: FrameErrorHooks;
	};

	get context(): ScramjetContext {
		return {
			config: this.controller.scramjetConfig,
			prefix: new URL(this.prefix, location.href),
			cookieJar: this.controller.cookieJar,
			interface: {
				getInjectScripts: yieldGetInjectScripts(
					this.controller.config,
					this.controller.scramjetConfig,
					new URL(this.prefix, location.href),
					this.controller.cookieJar,
					this.controller.config.codec.encode,
					this.controller.config.codec.decode
				),
				getWorkerInjectScripts: (meta, type, script) => {
					let str = "";

					str += script(this.controller.config.scramjetPath);
					str += script(this.prefix + this.controller.config.virtualWasmPath);
					str += script(
						"data:text/javascript;charset=utf-8;base64," +
							base64Encode(`
					(()=>{
						const { ScramjetClient, CookieJar, setWasm } = $scramjet;

						setWasm(Uint8Array.from(atob(self.WASM), (c) => c.charCodeAt(0)));
						delete self.WASM;

						const sjconfig = ${JSON.stringify(this.controller.scramjetConfig)};
						const prefix = new URL("${this.prefix}", location.href);

						const context = {
							config: sjconfig,
							prefix,
							interface: {
								codecEncode: ${this.controller.config.codec.encode.toString()},
								codecDecode: ${this.controller.config.codec.decode.toString()},
							},
						};

						const client = new ScramjetClient(globalThis, {
							context,
							transport: null,
						});

						client.hook();
					})();
					`)
					);

					return str;
				},
				codecEncode: this.controller.config.codec.encode,
				codecDecode: this.controller.config.codec.decode,
			},
		};
	}

	public plugins: ManagedPlugin[] = [];
	constructor(
		public controller: Controller,
		public element: HTMLIFrameElement,
		public options: FrameOptions = {}
	) {
		this.id = makeId();
		this.prefix = this.controller.prefix + this.id + "/";

		this.fetchHandler = new ScramjetFetchHandler({
			crossOriginIsolated: self.crossOriginIsolated,
			context: this.context,
			transport: controller.transport,
			async sendSetCookie(cookies, options) {
				await controller.persistCookies();
				await controller.propagateCookieSync(
					cookies.map(({ url, cookie }) => ({
						url: url.href,
						cookie,
					})),
					options
				);
			},
			async fetchBlobUrl(url) {
				return BareResponse.fromNativeResponse(await fetch(url));
			},
			async fetchDataUrl(url) {
				return BareResponse.fromNativeResponse(await fetch(url));
			},
		});

		this.hooks = {
			fetch: this.fetchHandler.hooks.fetch,
			init: Tap.create<FrameInitHooks>(),
			error: Tap.create<FrameErrorHooks>(),
		};

		element[CONTROLLERFRAME] = this;

		this.plugins = options.plugins ?? [];
		for (const plugin of this.plugins) {
			for (const dependency of plugin.dependencies) {
				const dependencyPlugin = this.plugins.find(
					(p) => p.name === dependency
				);
				if (!dependencyPlugin) {
					throw new Error(
						`Dependency ${dependency} not found for plugin ${plugin.name}`
					);
				}
			}
			plugin.install(this);
		}
	}

	getPlugin<T extends ManagedPlugin>(name: string): T {
		const plugin = this.plugins.find((p) => p.name === name) as T;
		if (!plugin) {
			throw new Error(`Plugin ${name} not found`);
		}
		return plugin;
	}

	back() {
		this.element.contentWindow?.history.back();
	}

	forward() {
		this.element.contentWindow?.history.forward();
	}

	reload() {
		this.element.contentWindow?.location.reload();
	}

	go(url: string) {
		const encoded = rewriteUrl(url, this.context, {
			//@ts-expect-error
			origin: new URL(location.href),
			//@ts-expect-error
			base: new URL(location.href),
		});
		this.element.src = encoded;
	}
}

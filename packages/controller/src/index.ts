import { MethodsDefinition, RpcHelper } from "@mercuryworkshop/rpc";
import {
	CookieJar,
	ScramjetFetchHandler,
	ScramjetHeaders,
	type ScramjetFetchContext,
} from "@mercuryworkshop/scramjet";
import { Controllerbound, SWbound } from "./types";

const cookieJar = new CookieJar();

type Config = {
	wasmPath: string;
	scramjetPath: string;
	virtualWasmPath: string;
	prefix: string;
};

const config: Config = {
	prefix: "/~/sj",
	virtualWasmPath: "/scramjet.wasm.js",
};

const frames: Record<string, Frame> = {};

let wasmPayload: string | null = null;

function makeId(): string {
	return Math.random().toString(36).substring(2, 10);
}

class Controller {
	id: string;
	prefix: string;
	frames: Frame[] = [];
	cookieJar = new CookieJar();

	private rpc: RpcHelper<Controllerbound, SWbound>;
	private ready: Promise<void>;
	private readyResolve: () => void;

	private methods: MethodsDefinition<Controllerbound> = {
		ready: async () => {
			this.readyResolve();
		},
		request: async (data) => {
			let path = new URL(data.rawUrl).pathname;
			const frame = this.frames.find((f) => path.startsWith(f.prefix));
			if (!frame) throw new Error("No frame found for request");

			if (path.startsWith(frame.prefix + "/" + config.virtualWasmPath)) {
				if (!wasmPayload) {
					const resp = await fetch(config.wasmPath);
					const buf = await resp.arrayBuffer();
					const b64 = btoa(
						new Uint8Array(buf)
							.reduce(
								(data, byte) => (data.push(String.fromCharCode(byte)), data),
								[] as any
							)
							.join("")
					);

					let payload = "";
					payload +=
						"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
					payload += `self.WASM = '${b64}';`;
					wasmPayload = payload;
				}

				return [
					{
						body: wasmPayload,
						status: 200,
						statusText: "OK",
						headers: {
							"Content-Type": ["application/javascript"],
						},
					},
					[],
				];
			}

			let sjheaders = new ScramjetHeaders();
			for (let [k, v] of Object.entries(data.initialHeaders)) {
				for (let vv of v) {
					sjheaders.set(k, vv);
				}
			}

			const fetchresponse = await frame.fetchHandler.handleFetch({
				initialHeaders: sjheaders,
				rawClientUrl: data.rawClientUrl
					? new URL(data.rawClientUrl)
					: undefined,
				rawUrl: new URL(data.rawUrl),
				destination: data.destination,
				method: data.method,
				mode: data.mode,
				referrer: data.referrer,
				forceCrossOriginIsolated: data.forceCrossOriginIsolated,
				body: data.body,
				cache: data.cache,
				cookieStore: this.cookieJar,
			});

			return [
				{
					body: fetchresponse.body,
					status: fetchresponse.status,
					statusText: fetchresponse.statusText,
					headers: fetchresponse.headers,
				},
				fetchresponse.body instanceof ReadableStream ||
				fetchresponse.body instanceof ArrayBuffer
					? [fetchresponse.body]
					: [],
			];
		},
	};

	constructor(serviceworker: ServiceWorker) {
		this.id = makeId();
		this.prefix = config.prefix + "/" + this.id;

		this.ready = new Promise<void>((resolve) => {
			this.readyResolve = resolve;
		});

		let channel = new MessageChannel();
		this.rpc = new RpcHelper<Controllerbound, SWbound>(
			this.methods,
			"swchannel",
			(data, transfer) => {
				channel.port1.postMessage(data, transfer);
			}
		);
		channel.port1.addEventListener("message", (e) => {
			this.rpc.recieve(e.data);
		});
		channel.port1.start();

		serviceworker.postMessage(
			{
				$controller$init: {
					prefix: config.prefix + "/" + this.id,
					id: this.id,
				},
			},
			[channel.port2]
		);
	}

	createFrame(): Frame {
		const frame = new Frame(this);
		this.frames.push(frame);
		return frame;
	}

	wait(): Promise<void> {
		return this.ready;
	}
}

class Frame {
	fetchHandler: ScramjetFetchHandler;
	id: string;
	prefix: string;

	constructor(public controller: Controller) {
		this.id = makeId();
		this.prefix = this.controller.prefix + "/" + this.id;

		this.fetchHandler = new ScramjetFetchHandler({
			client: null,
			cookieJar: this.controller.cookieJar,
			prefix: new URL(
				config.prefix + "/" + this.controller.id + "/" + this.id,
				location.href
			),
			sendClientbound: (type, msg) => {},
			onServerbound: (type, listener) => {},
		});
	}
}

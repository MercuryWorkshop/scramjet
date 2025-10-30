import {
	CookieJar,
	ScramjetFetchHandler,
	ScramjetHeaders,
	type ScramjetFetchContext,
} from "@mercuryworkshop/scramjet";

declare var clients: Clients;

const cookieJar = new CookieJar();

type Config = {
	wasmPath: string;
	scramjetPath: string;
	virtualWasmPath: string;
	prefix: string;
};

const config: Config = {
	prefix: "~/sj",
	virtualWasmPath: "/scramjet.wasm.js",
};

type Frame = {
	fetchHandler: ScramjetFetchHandler;
};

let frames: Record<string, Frame>;

function shouldRoute(fetch: FetchEvent): boolean {
	const url = new URL(fetch.request.url);
	if (url.pathname === config.prefix + config.virtualWasmPath) {
		return true;
	}

	for (let id in frames) {
		if (url.pathname.startsWith(config.prefix + "/" + id + "/")) {
			return true;
		}
	}

	return false;
}

async function handleFetch(fetch: FetchEvent) {
	if (fetch.request.url.startsWith(config.prefix + config.virtualWasmPath)) {
		return await makeWasmResponse();
	}

	let frame;
	for (let id in frames) {
		if (fetch.request.url.startsWith(config.prefix + "/" + id + "/")) {
			frame = frames[id];
			break;
		}
	}
	if (!frame) throw new Error("No frame found for fetch");

	// create fetch context

	let headers = new ScramjetHeaders();
	for (let [k, v] of Object.entries(fetch.request.headers)) {
		headers.set(k, v);
	}

	const client = await clients.get(fetch.clientId);

	const context: ScramjetFetchContext = {
		initialHeaders: headers,
		rawClientUrl: new URL(client.url),
		rawUrl: new URL(fetch.request.url),
		destination: fetch.request.destination,
		method: fetch.request.method,
		mode: fetch.request.mode,
		referrer: fetch.request.referrer,
		forceCrossOriginIsolated: crossOriginIsolated,
		body: fetch.request.body,
		cache: fetch.request.cache,
		cookieStore: cookieJar,
	};

	const fetchresponse = await frame.fetchHandler.handleFetch(context);
}
window.addEventListener("message", async (event) => {
	let data = event.data;
	if (!(data && "$sandboxsw$type" in data)) return;
	let controller = controllers.find(
		(c) => c.controllerframe.contentWindow == event.source
	);
	if (!controller) {
		console.error("No controller found for message", data);
		return;
	}

	try {
		if (data.$sandboxsw$type == "request") {
			let domain = data.$sandboxsw$domain;
			let message = data.$sandboxsw$message;
			let token = data.$sandboxsw$token;

			let fn = (methods as any)[domain];

			let [result, transfer] = await fn(message, controller);
			controller.window.postMessage(
				{
					$sandboxsw$type: "response",
					$sandboxsw$token: token,
					$sandboxsw$message: result,
				},
				controller.baseurl.origin,
				transfer
			);
		} else if (data.$sandboxsw$type == "confirm") {
			console.log(controller.rootdomain + " controller activated");
			controller.readyResolve();
		}
	} catch (e) {
		console.log(e);
		console.error("error in response", e);
	}
});

let wasmPayload: string | null = null;

async function makeWasmResponse() {
	if (!wasmPayload) {
		const resp = await fetch(scramjetWASM);
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

	return {
		body: wasmPayload,
		headers: { "Content-Type": "application/javascript" },
		status: 200,
		statusText: "OK",
	};
}

let synctoken = 0;
let syncPool: { [token: number]: (val: any) => void } = {};
export function sendFrame<T extends keyof Framebound>(
	tab: Tab,
	type: T,
	message: Framebound[T][0]
): Promise<Framebound[T][1]> {
	let token = synctoken++;

	tab.frame.frame.contentWindow!.postMessage(
		{
			$ipc$type: "request",
			$ipc$token: token,
			$ipc$message: {
				type,
				message,
			},
		},
		"*"
	);

	return new Promise((res) => {
		syncPool[token] = res;
	});
}

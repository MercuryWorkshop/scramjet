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

const frames: Record<string, Frame> = {};

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

let wasmPayload: string | null = null;
async function handleFetch(ev: FetchEvent): Promise<Response> {
	if (ev.request.url.startsWith(config.prefix + config.virtualWasmPath)) {
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

		return new Response(wasmPayload, {
			headers: { "Content-Type": "application/javascript" },
		});
	}

	let frame: Frame;
	for (let id in frames) {
		if (ev.request.url.startsWith(config.prefix + "/" + id + "/")) {
			frame = frames[id];
			break;
		}
	}
	if (!frame) throw new Error("No frame found for fetch");

	// create fetch context

	let headers = new ScramjetHeaders();
	for (let [k, v] of Object.entries(ev.request.headers)) {
		headers.set(k, v);
	}

	const client = await clients.get(ev.clientId);

	const context: ScramjetFetchContext = {
		initialHeaders: headers,
		rawClientUrl: new URL(client.url),
		rawUrl: new URL(ev.request.url),
		destination: ev.request.destination,
		method: ev.request.method,
		mode: ev.request.mode,
		referrer: ev.request.referrer,
		forceCrossOriginIsolated: crossOriginIsolated,
		body: ev.request.body,
		cache: ev.request.cache,
		cookieStore: cookieJar,
	};

	const fetchresponse = await frame.fetchHandler.handleFetch(context);

	const respHeaders = new Headers();
	for (let [k, v] of Object.entries(fetchresponse.headers)) {
		let val = typeof v === "string" ? v : (v?.[0] ?? undefined);
		if (val !== undefined) {
			respHeaders.set(k, val);
		}
	}

	return new Response(fetchresponse.body, {
		status: fetchresponse.status,
		statusText: fetchresponse.statusText,
		headers: respHeaders,
	});
}

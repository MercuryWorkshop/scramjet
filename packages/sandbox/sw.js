class SandboxThing {
	counter = 0;
	promises = new Map();

	async find() {
		let swclients = await clients.matchAll({ includeUncontrolled: true });
		for (const client of swclients) {
			if (new URL(client.url).pathname.startsWith("/controller")) {
				return client;
			}
		}
		return null;
	}

	async request(domain, message, transfer) {
		let controller = await this.find();
		if (!controller) throw new Error("couldn't find controller");
		return new Promise((resolve, reject) => {
			this.promises.set(this.counter, { resolve, reject });
			controller.postMessage(
				{
					$sandboxsw$type: "request",
					$sandboxsw$token: this.counter++,
					$sandboxsw$domain: domain,
					$sandboxsw$message: message,
				},
				transfer
			);
		});
	}

	handleMessage(token, message, error) {
		if (this.promises.has(token)) {
			let { resolve, reject } = this.promises.get(token);
			this.promises.delete(token);
			if (error) {
				reject(error);
			} else {
				resolve(message);
			}
		}
	}
}

let sb = new SandboxThing();

async function handleFetch(event) {
	const client = await self.clients.get(event.clientId);

	let resp = await sb.request(
		"fetch",
		{
			rawUrl: event.request.url,
			destination: event.request.destination,
			mode: event.request.mode,
			referrer: event.request.referrer,
			method: event.request.method,
			body: event.request.body,
			cache: event.request.cache,
			forceCrossOriginIsolated: false,
			initialHeaders: Object.fromEntries([...event.request.headers.entries()]),
			rawClientUrl: client ? client.url : undefined,
		},
		event.request.body instanceof ReadableStream ||
			event.request.body instanceof ArrayBuffer
			? [event.request.body]
			: undefined
	);

	return new Response(resp.body, {
		status: resp.status,
		statusText: resp.statusText,
		headers: resp.headers,
	});
}

self.addEventListener("fetch", (event) => {
	let url = new URL(event.request.url);
	if (url.origin == location.origin && url.pathname.startsWith("/controller")) {
		return;
	}
	event.respondWith(
		(async () => {
			try {
				return await handleFetch(event);
			} catch (e) {
				console.error(e);
				return new Response("SandboxSW Error: " + e + e.stack, {
					status: 500,
				});
			}
		})()
	);
});

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (e) => {
	e.waitUntil(self.clients.claim());
});

console.log("sw initialized");
self.addEventListener("message", (e) => {
	let data = e.data;
	if (!("$sandboxsw$type" in data)) return;
	if (data.$sandboxsw$type === "wake") {
		e.source.postMessage({
			$sandboxsw$type: "confirm",
		});
	} else if (data.$sandboxsw$type === "response") {
		sb.handleMessage(
			data.$sandboxsw$token,
			data.$sandboxsw$message,
			data.$sandboxsw$error
		);
	}
});

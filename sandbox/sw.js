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

	async request(domain, message) {
		let controller = await this.find();
		if (!controller) throw new Error("couldn't find controller");
		return new Promise((resolve, reject) => {
			this.promises.set(this.counter, { resolve, reject });
			controller.postMessage({
				$sandboxsw$type: "request",
				$sandboxsw$token: this.counter++,
				$sandboxsw$domain: domain,
				$sandboxsw$message: message,
			});
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

// export interface ScramjetFetchContext {
// 	rawUrl: URL;
// 	destination: RequestDestination;
// 	mode: RequestMode;
// 	referrer: string;
// 	method: string;
// 	body: BodyType | null;
// 	cache: RequestCache;
// 	forceCrossOriginIsolated: boolean;
// 	initialHeaders: ScramjetHeaders;
// 	cookieStore: CookieStore;
// 	rawClientUrl?: URL;
// }
//
// interface ScramjetFetchResponse {
// 	body: BodyType;
// 	headers: BareHeaders;
// 	status: number;
// 	statusText: string;
// }
async function handleFetch(event) {
	let resp = await sb.request("fetch", {
		rawUrl: event.request.url,
		destination: event.request.destination,
		mode: event.request.mode,
		referrer: event.request.referrer,
		method: event.request.method,
		body: event.request.body,
		cache: event.request.cache,
		forceCrossOriginIsolated: false,
		initialHeaders: Object.fromEntries([...event.request.headers.entries()]),
		rawClientUrl: event.clientId ? new URL(event.clientId) : undefined,
	});

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
clients.matchAll({ includeUncontrolled: true }).then((swclients) => {
	for (const client of swclients) {
		if (new URL(client.url).pathname.startsWith("/controller")) {
			client.postMessage({
				$sandboxsw$type: "confirm",
			});
		}
	}
});
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

// addEventListener("clientschanged", async () => {
//  const clients = await self.clients.matchAll({ includeUncontrolled: true });
//  for (const client of clients) {
//   if (new URL(client.url).pathname.startsWith("/controller")) {
//    _controller.client = client;
//    client.postMessage({
//     $sandboxsw$type: "controller-registered",
//     timestamp: Date.now()
//    });
//    console.log("Controller client registered and notified");
//   }
//  }
// });

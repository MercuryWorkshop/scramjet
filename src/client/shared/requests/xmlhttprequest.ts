import { config, unrewriteUrl, rewriteUrl } from "../../../shared";
import { ScramjetClient } from "../../client";
let nativeworker;
let postmessage;

if (self.Worker) {
	nativeworker = Worker;
	postmessage = Worker.prototype.postMessage;
}

export default function (client: ScramjetClient, self: Self) {
	let worker;
	if (self.Worker) {
		worker = new nativeworker(config.files.sync);
	}
	const ARGS = Symbol("xhr original args");
	const HEADERS = Symbol("xhr headers");

	client.Proxy("XMLHttpRequest.prototype.open", {
		apply(ctx) {
			if (ctx.args[1]) ctx.args[1] = rewriteUrl(ctx.args[1], client.meta);
			ctx.this[ARGS] = ctx.args;
		},
	});

	client.Proxy("XMLHttpRequest.prototype.setRequestHeader", {
		apply(ctx) {
			const headers = ctx.this[HEADERS] || (ctx.this[HEADERS] = {});
			headers[ctx.args[0]] = ctx.args[1];
		},
	});

	client.Proxy("XMLHttpRequest.prototype.send", {
		apply(ctx) {
			const args = ctx.this[ARGS];
			if (!args || args[2]) return;

			if (!self.$scramjet.config.flags.syncxhr) {
				console.warn("sync xhr disabled in flags");

				return;
			}

			// it's a sync request
			// sync xhr to service worker is not supported
			// there's a nice way of polyfilling this though, we can spin on an atomic using sharedarraybuffer. this will maintain the sync behavior

			// @ts-expect-error maxbytelength not in types yet i guess
			const sab = new SharedArrayBuffer(1024, { maxByteLength: 2147483647 });
			const view = new DataView(sab);

			postmessage.call(worker, {
				sab,
				args,
				headers: ctx.this[HEADERS],
				body: ctx.args[0],
			});

			const now = performance.now();
			while (view.getUint8(0) === 0) {
				if (performance.now() - now > 1000) {
					throw new Error("xhr timeout");
				}
				/* spin */
			}

			const status = view.getUint16(1);
			const headersLength = view.getUint32(3);

			const headersab = new Uint8Array(headersLength);
			headersab.set(new Uint8Array(sab.slice(7, 7 + headersLength)));
			const headers = new TextDecoder().decode(headersab);

			const bodyLength = view.getUint32(7 + headersLength);
			const bodyab = new Uint8Array(bodyLength);
			bodyab.set(
				new Uint8Array(
					sab.slice(11 + headersLength, 11 + headersLength + bodyLength)
				)
			);
			const body = new TextDecoder().decode(bodyab);

			// these should be using proxies to not leak scram strings but who cares
			client.RawTrap(ctx.this, "status", {
				get() {
					return status;
				},
			});
			client.RawTrap(ctx.this, "responseText", {
				get() {
					return body;
				},
			});
			client.RawTrap(ctx.this, "response", {
				get() {
					if (ctx.this.responseType === "arraybuffer") return bodyab.buffer;

					return body;
				},
			});
			client.RawTrap(ctx.this, "responseXML", {
				get() {
					const parser = new DOMParser();

					return parser.parseFromString(body, "text/xml");
				},
			});
			client.RawTrap(ctx.this, "getAllResponseHeaders", {
				get() {
					return () => headers;
				},
			});
			client.RawTrap(ctx.this, "getResponseHeader", {
				get() {
					return (header: string) => {
						const re = new RegExp(`^${header}: (.*)$`, "m");
						const match = re.exec(headers);

						return match ? match[1] : null;
					};
				},
			});

			// send has no return value right
			ctx.return(undefined);
		},
	});

	client.Trap("XMLHttpRequest.prototype.responseURL", {
		get(ctx) {
			return unrewriteUrl(ctx.get() as string);
		},
	});
}

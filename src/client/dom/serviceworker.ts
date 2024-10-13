import { config, rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";
import { type MessageC2W } from "../../worker";
import { getOwnPropertyDescriptorHandler } from "../helpers";

// we need a late order because we're mangling with addEventListener at a higher level
export const order = 2;

export const enabled = () => config.flags.serviceworkers;

export function disabled(_client: ScramjetClient, _self: Self) {
	Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
}
let realPostMessage;
if (self.ServiceWorker) {
	realPostMessage = ServiceWorker.prototype.postMessage;
}

export default function (client: ScramjetClient, _self: Self) {
	let registration;

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			if (registration === ctx.this) {
				// do nothing
				ctx.return(undefined);
			}
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			if (registration === ctx.this) {
				// do nothing
				ctx.return(undefined);
			}
		},
	});

	client.Proxy("navigator.serviceWorker.getRegistration", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve(registration)));
		},
	});

	client.Proxy("navigator.serviceWorker.getRegistrations", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve([registration])));
		},
	});

	client.Trap("navigator.serviceWorker.ready", {
		get(_ctx) {
			console.log(registration);

			return new Promise((resolve) => resolve(registration));
		},
	});

	client.Proxy("navigator.serviceWorker.register", {
		apply(ctx) {
			if (ctx.args[0] instanceof URL) ctx.args[0] = ctx.args[0].href;
			let url = rewriteUrl(ctx.args[0], client.meta) + "?dest=serviceworker";
			if (ctx.args[1] && ctx.args[1].type === "module") {
				url += "&type=module";
			}

			const nativeSharedWorker = client.natives["SharedWorker"];
			const worker = new nativeSharedWorker(url);

			const handle = worker.port;

			realPostMessage.call(
				client.serviceWorker.controller,
				{
					scramjet$type: "registerServiceWorker",
					port: handle,
					origin: client.url.origin,
				} as MessageC2W,
				[handle]
			);

			const fakeRegistration = new Proxy(
				{
					__proto__: ServiceWorkerRegistration.prototype,
				},
				{
					get(target, prop) {
						if (prop === "installing") {
							return null;
						}
						if (prop === "waiting") {
							return null;
						}
						if (prop === "active") {
							return handle;
						}
						if (prop === "scope") {
							return ctx.args[0];
						}
						if (prop === "unregister") {
							return () => {};
						}

						if (prop === "addEventListener") {
							return () => {};
						}

						return Reflect.get(target, prop);
					},
					getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
				}
			);
			registration = fakeRegistration;

			ctx.return(new Promise((resolve) => resolve(fakeRegistration)));
		},
	});
}

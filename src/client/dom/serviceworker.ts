import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";
import { type MessageC2W } from "../../worker";
import { getOwnPropertyDescriptorHandler } from "../helpers";
import { flagEnabled } from "../../scramjet";

// we need a late order because we're mangling with addEventListener at a higher level
export const order = 2;

export const enabled = (client: ScramjetClient) =>
	flagEnabled("serviceworkers", client.url);

export function disabled(_client: ScramjetClient, _self: Self) {
	Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
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

	client.Proxy("ServiceWorkerContainer.prototype.getRegistration", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve(registration)));
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.getRegistrations", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve([registration])));
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.ready", {
		get(_ctx) {
			return new Promise((resolve) => resolve(registration));
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.controller", {
		get(ctx) {
			return registration?.active;
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.register", {
		apply(ctx) {
			let url = rewriteUrl(ctx.args[0], client.meta) + "?dest=serviceworker";
			if (ctx.args[1] && ctx.args[1].type === "module") {
				url += "&type=module";
			}

			const worker = client.natives.construct("SharedWorker", url);
			const handle = worker.port;
			const controller = client.descriptors.get(
				"ServiceWorkerContainer.prototype.controller",
				client.serviceWorker
			);

			client.natives.call(
				"ServiceWorker.prototype.postMessage",
				controller,
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

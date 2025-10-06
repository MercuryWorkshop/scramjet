import { ScramjetClient } from "@client/index";
import { type MessageC2W } from "@/worker";
import { flagEnabled } from "@/shared";
import { rewriteUrl } from "@rewriters/url";

// we need a late order because we're mangling with addEventListener at a higher level
export const order = 2;

export const enabled = (client: ScramjetClient) =>
	flagEnabled("serviceworkers", client.url);

export function disabled(_client: ScramjetClient, _self: Self) {
	Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
}

type FakeRegistrationState = {
	scope: string;
	active: ServiceWorker;
};

export default function (client: ScramjetClient, _self: Self) {
	const registrationmap: WeakMap<
		ServiceWorkerRegistration,
		FakeRegistrationState
	> = new WeakMap();
	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			if (registrationmap.get(ctx.this)) {
				// do nothing
				ctx.return(undefined);
			}
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			if (registrationmap.get(ctx.this)) {
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
			const fakeRegistration = new EventTarget() as ServiceWorkerRegistration;
			Object.setPrototypeOf(
				fakeRegistration,
				self.ServiceWorkerRegistration.prototype
			);
			fakeRegistration.constructor = ctx.fn;
			let url = rewriteUrl(ctx.args[0], client.meta) + "?dest=serviceworker";
			if (ctx.args[1] && ctx.args[1].type === "module") {
				url += "&type=module";
			}

			const worker = client.natives.construct("SharedWorker", url);
			const handle = worker.port;
			const state: FakeRegistrationState = {
				scope: ctx.args[0],
				active: handle as ServiceWorker,
			};
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

			registrationmap.set(fakeRegistration, state);
			ctx.return(new Promise((resolve) => resolve(fakeRegistration)));
		},
	});
}

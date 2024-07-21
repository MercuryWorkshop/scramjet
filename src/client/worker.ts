import { client } from ".";
import { encodeUrl } from "./shared";

client.Proxy("Worker", {
	construct({ args }) {
		if (args[0] instanceof URL) args[0] = args[0].href;
		if (args[0].startsWith("blob:") || args[0].startsWith("data:")) {
			// TODO
			return;
		}

		args[0] = encodeUrl(args[0]) + "?dest=worker";

		if (args[1] && args[1].type === "module") {
			args[0] += "&type=module";
		}
	},
});

if ("window" in self) {
	Worklet.prototype.addModule = new Proxy(Worklet.prototype.addModule, {
		apply(target, thisArg, argArray) {
			argArray[0] = encodeUrl(argArray[0]);

			return Reflect.apply(target, thisArg, argArray);
		},
	});

	client.Proxy("navigator.serviceWorker.register", {
		apply(ctx) {
			if (ctx.args[0] instanceof URL) ctx.args[0] = ctx.args[0].href;
			let url = encodeUrl(ctx.args[0]) + "?dest=serviceworker";
			if (ctx.args[1] && ctx.args[1].type === "module") {
				url += "&type=module";
			}
			let worker = new SharedWorker(url);

			let handle = worker.port;

			navigator.serviceWorker.controller.postMessage({
				scramjet$type: "registerServiceWorker",
				port: handle,
			});

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

						return Reflect.get(target, prop);
					},
				}
			);

			ctx.return(new Promise((resolve) => resolve(fakeRegistration)));
		},
	});
}

client.Proxy("importScripts", {
	apply(ctx) {
		for (const i in ctx.args) {
			ctx.args[i] = encodeUrl(ctx.args[i]);
		}
	},
});

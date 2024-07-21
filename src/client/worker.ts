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
	//@ts-expect-error temporary until nested sw support
	delete window.Navigator.prototype.serviceWorker;
}

client.Proxy("importScripts", {
	apply(ctx) {
		for (const i in ctx.args) {
			ctx.args[i] = encodeUrl(ctx.args[i]);
		}
	},
});

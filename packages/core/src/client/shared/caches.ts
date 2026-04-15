import { ScramjetClient } from "@client/index";
import { String } from "@/shared/snapshot";

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("CacheStorage.prototype.open", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Proxy("CacheStorage.prototype.has", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Proxy("CacheStorage.prototype.match", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("CacheStorage.prototype.delete", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Proxy("Cache.prototype.add", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Cache.prototype.addAll", {
		apply(ctx) {
			const requests = [...ctx.args[0]];
			for (let i = 0; i < requests.length; i++) {
				const url = String(requests[i]);
				requests[i] = client.rewriteUrl(url);
			}
			ctx.args[0] = requests;
		},
	});

	client.Proxy("Cache.prototype.put", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Cache.prototype.match", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Cache.prototype.matchAll", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Cache.prototype.keys", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});

	client.Proxy("Cache.prototype.delete", {
		apply(ctx) {
			const url = String(ctx.args[0]);
			ctx.args[0] = client.rewriteUrl(url);
		},
	});
}

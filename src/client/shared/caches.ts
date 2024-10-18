import { rewriteUrl } from "../../shared";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	//TODO: this doesnt support request objects, do that later (i dont feel like it)
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
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Proxy("CacheStorage.prototype.delete", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Proxy("Cache.prototype.add", {
		apply(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Proxy("Cache.prototype.addAll", {
		apply(ctx) {
			for (let i = 0; i < ctx.args[0].length; i++) {
				ctx.args[0][i] = rewriteUrl(ctx.args[0][i], client.meta);
			}
		},
	});

	client.Proxy("Cache.prototype.put", {
		apply(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Proxy("Cache.prototype.match", {
		apply(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Proxy("Cache.prototype.matchAll", {
		apply(ctx) {
			if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Proxy("Cache.prototype.keys", {
		apply(ctx) {
			if (ctx.args[0]) ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});

	client.Proxy("Cache.prototype.delete", {
		apply(ctx) {
			ctx.args[0] = rewriteUrl(ctx.args[0], client.meta);
		},
	});
}

import { iswindow } from "..";
import { ProxyCtx, ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	// an automated approach to cleaning the documentProxy from dom functions
	// it will trigger an illegal invocation if you pass the proxy to c++ code, we gotta hotswap it out with the real one

	for (const target of [self]) {
		for (const prop in target) {
			try {
				if (typeof target[prop] === "function") {
					client.RawProxy(target, prop, {
						apply(ctx) {
							unproxy(ctx, client);
						},
					});
				}
			} catch (e) {}
		}
	}

	if (!iswindow) return;

	for (const target of [
		self.Node.prototype,
		self.MutationObserver.prototype,
		self.document,
	]) {
		for (const prop in target) {
			try {
				if (typeof target[prop] === "function") {
					client.RawProxy(target, prop, {
						apply(ctx) {
							unproxy(ctx, client);
						},
					});
				}
			} catch (e) {}
		}
	}
}

export function unproxy(ctx: ProxyCtx, client: ScramjetClient) {
	const self = client.global;
	if (ctx.this === client.windowProxy) ctx.this = self;
	if (ctx.this === client.documentProxy) ctx.this = self.document;

	for (const i in ctx.args) {
		if (ctx.args[i] === client.documentProxy) ctx.args[i] = self.document;
		if (ctx.args[i] === client.windowProxy) ctx.args[i] = self;
	}
}

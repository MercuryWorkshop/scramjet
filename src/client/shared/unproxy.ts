import { iswindow } from "..";
import { ProxyCtx, ScramjetClient } from "../client";

// we don't want to end up overriding a property on window that's derived from a prototype until we've proxied the prototype
export const order = 3;

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

	client.Proxy("Object.getOwnPropertyDescriptor", {
		apply(ctx) {
			const desc = ctx.call();

			if (!desc) return;

			if (desc.get) {
				client.RawProxy(desc, "get", {
					apply(ctx) {
						// value of this in the getter needs to be corrected
						unproxy(ctx, client);
					},
				});
			}

			if (desc.set) {
				client.RawProxy(desc, "set", {
					apply(ctx) {
						unproxy(ctx, client);
					},
				});
			}

			// i don't think we have to care about value but it's worth looking into

			ctx.return(desc);
		},
	});
}

export function unproxy(ctx: ProxyCtx, client: ScramjetClient) {
	const self = client.global;
	if (ctx.this === client.globalProxy) ctx.this = self;
	if (ctx.this === client.documentProxy) ctx.this = self.document;

	for (const i in ctx.args) {
		if (ctx.args[i] === client.documentProxy) ctx.args[i] = self.document;
		if (ctx.args[i] === client.globalProxy) ctx.args[i] = self;
	}
}

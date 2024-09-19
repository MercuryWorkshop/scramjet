import { SCRAMJETCLIENT } from "../../symbols";
import { ScramjetClient } from "../client";
import { nativeGetOwnPropertyDescriptor } from "../natives";
import { config, decodeUrl, htmlRules, unrewriteHtml } from "../../shared";
import {
	encodeUrl,
	rewriteCss,
	rewriteHtml,
	rewriteJs,
	rewriteSrcset,
} from "../../shared";
import type { URLMeta } from "../../shared/rewriters/url";

export default function (client: ScramjetClient, self: typeof window) {
	const attrObject = {
		nonce: [self.HTMLElement],
		integrity: [self.HTMLScriptElement, self.HTMLLinkElement],
		csp: [self.HTMLIFrameElement],
		src: [
			self.HTMLImageElement,
			self.HTMLMediaElement,
			self.HTMLIFrameElement,
			self.HTMLEmbedElement,
			self.HTMLScriptElement,
			self.HTMLSourceElement,
		],
		href: [self.HTMLAnchorElement, self.HTMLLinkElement],
		data: [self.HTMLObjectElement],
		action: [self.HTMLFormElement],
		formaction: [self.HTMLButtonElement, self.HTMLInputElement],
		srcdoc: [self.HTMLIFrameElement],
		srcset: [self.HTMLImageElement, self.HTMLSourceElement],
		imagesrcset: [self.HTMLLinkElement],
	};

	const urlinterfaces = [
		self.HTMLAnchorElement.prototype,
		self.HTMLAreaElement.prototype,
	];
	const originalhrefs = [
		nativeGetOwnPropertyDescriptor(self.HTMLAnchorElement.prototype, "href"),
		nativeGetOwnPropertyDescriptor(self.HTMLAreaElement.prototype, "href"),
	];

	const attrs = Object.keys(attrObject);

	for (const attr of attrs) {
		for (const element of attrObject[attr]) {
			const descriptor = nativeGetOwnPropertyDescriptor(
				element.prototype,
				attr
			);
			Object.defineProperty(element.prototype, attr, {
				get() {
					if (["src", "data", "href", "action", "formaction"].includes(attr)) {
						return decodeUrl(descriptor.get.call(this));
					}

					return descriptor.get.call(this);
				},

				set(value) {
					if (["nonce", "integrity", "csp"].includes(attr)) {
						return;
					} else if (
						["src", "data", "href", "action", "formaction"].includes(attr)
					) {
						value = encodeUrl(value, client.meta);
					} else if (attr === "srcdoc") {
						value = rewriteHtml(
							value,
							client.cookieStore,
							{
								// srcdoc preserves parent origin i think
								base: new URL(client.url.origin),
								origin: new URL(client.url.origin),
							} as URLMeta,
							true
						);
					} else if (["srcset", "imagesrcset"].includes(attr)) {
						value = rewriteSrcset(value, client.meta);
					}

					descriptor.set.call(this, value);
				},
			});
		}
	}

	// note that href is not here
	const urlprops = [
		"protocol",
		"hash",
		"host",
		"hostname",
		"origin",
		"pathname",
		"port",
		"search",
	];
	for (const prop of urlprops) {
		for (const i in urlinterfaces) {
			const target = urlinterfaces[i];
			const desc = originalhrefs[i];
			client.RawTrap(target, prop, {
				get(ctx) {
					const href = desc.get.call(ctx.this);
					if (!href) return href;

					const url = new URL(decodeUrl(href));

					return url[prop];
				},
			});
		}
	}

	client.Trap("Node.prototype.baseURI", {
		get() {
			// TODO this should be using ownerdocument but who gaf
			const base = self.document.querySelector("base");
			if (base) {
				return new URL(base.href, client.url).href;
			}

			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Proxy("Element.prototype.setAttribute", {
		apply(ctx) {
			const [name, value] = ctx.args;

			const rule = htmlRules.find((rule) => {
				const r = rule[name];
				if (!r) return false;
				if (r === "*") return true;
				if (typeof r === "function") return false; // this can't happen but ts

				return r.includes(ctx.this.tagName.toLowerCase());
			});

			if (rule) {
				ctx.args[1] = rule.fn(value, client.meta, client.cookieStore);
				ctx.fn.call(ctx.this, `data-scramjet-${ctx.args[0]}`, value);
			}
		},
	});

	client.Proxy("Element.prototype.getAttribute", {
		apply(ctx) {
			const [name] = ctx.args;

			if (ctx.fn.call(ctx.this, `data-scramjet-${name}`)) {
				ctx.return(ctx.fn.call(ctx.this, `data-scramjet-${name}`));
			}
		},
	});

	client.Trap("Element.prototype.innerHTML", {
		set(ctx, value: string) {
			let newval;
			if (ctx.this instanceof self.HTMLScriptElement) {
				newval = rewriteJs(value, client.meta);
			} else if (ctx.this instanceof self.HTMLStyleElement) {
				newval = rewriteCss(value, client.meta);
			} else {
				newval = rewriteHtml(value, client.cookieStore, client.meta);
			}

			ctx.set(newval);
		},
		get(ctx) {
			return unrewriteHtml(ctx.get());
		},
	});

	client.Trap("Element.prototype.outerHTML", {
		set(ctx, value: string) {
			ctx.set(rewriteHtml(value, client.cookieStore, client.meta));
		},
		get(ctx) {
			return unrewriteHtml(ctx.get());
		},
	});

	client.Trap("HTMLIFrameElement.prototype.contentWindow", {
		get(ctx) {
			const realwin = ctx.get() as Window;

			if (SCRAMJETCLIENT in realwin.self) {
				if (realwin.location.href.includes("accounts.google.com")) return null; // don't question it

				return realwin.self[SCRAMJETCLIENT].globalProxy;
			} else {
				// hook the iframe
				const newclient = new ScramjetClient(realwin.self);
				newclient.hook();

				return newclient.globalProxy;
			}
		},
	});

	client.Trap("HTMLIFrameElement.prototype.contentDocument", {
		get(ctx) {
			const contentwindow =
				client.descriptors["HTMLIFrameElement.prototype.contentWindow"].get;
			const realwin = contentwindow.apply(ctx.this);

			if (SCRAMJETCLIENT in realwin.self) {
				return realwin.self[SCRAMJETCLIENT].documentProxy;
			} else {
				const newclient = new ScramjetClient(realwin.self);
				newclient.hook();

				return newclient.documentProxy;
			}
		},
	});

	client.Trap("TreeWalker.prototype.currentNode", {
		get(ctx) {
			return ctx.get();
		},
		set(ctx, value) {
			if (value == client.documentProxy) {
				return ctx.set(self.document);
			}

			return ctx.set(value);
		},
	});

	client.Trap("Node.prototype.ownerDocument", {
		get(ctx) {
			return client.documentProxy;
			const doc = ctx.get() as Document | null;
			if (!doc) return null;

			const scram: ScramjetClient = doc[SCRAMJETCLIENT];
			if (!scram) return doc; // ??

			return scram.documentProxy;
		},
	});

	client.Proxy("document.write", {
		apply(ctx) {
			ctx.args[0] = rewriteHtml(
				ctx.args[0],
				client.cookieStore,
				client.meta,
				true
			);
		},
	});

	client.Proxy("document.writeln", {
		apply(ctx) {
			// this injects scramjet multiple times but who gaf
			ctx.args[0] = rewriteHtml(
				ctx.args[0],
				client.cookieStore,
				client.meta,
				true
			);
		},
	});
}

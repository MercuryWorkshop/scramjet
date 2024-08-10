import { ScramjetClient } from "../client";
import { config, decodeUrl } from "../shared";
import {
	encodeUrl,
	rewriteCss,
	rewriteHtml,
	rewriteJs,
	rewriteSrcset,
} from "../shared";

declare global {
	interface Element {
		$origattrs: Record<string, string>;
	}
}
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
		],
		href: [self.HTMLAnchorElement, self.HTMLLinkElement],
		data: [self.HTMLObjectElement],
		action: [self.HTMLFormElement],
		formaction: [self.HTMLButtonElement, self.HTMLInputElement],
		srcdoc: [self.HTMLIFrameElement],
		srcset: [self.HTMLImageElement, self.HTMLSourceElement],
		imagesrcset: [self.HTMLLinkElement],
	};

	const attrs = Object.keys(attrObject);

	for (const attr of attrs) {
		for (const element of attrObject[attr]) {
			const descriptor = Object.getOwnPropertyDescriptor(
				element.prototype,
				attr
			);
			Object.defineProperty(element.prototype, attr, {
				get() {
					if (["src", "data", "href", "action", "formaction"].includes(attr)) {
						return decodeUrl(descriptor.get.call(this));
					}

					if (this.$origattrs[attr]) {
						return this.$origattrs[attr];
					}

					return descriptor.get.call(this);
				},

				set(value) {
					this.$origattrs[attr] = value;

					if (["nonce", "integrity", "csp"].includes(attr)) {
						return;
					} else if (
						["src", "data", "href", "action", "formaction"].includes(attr)
					) {
						value = encodeUrl(value);
					} else if (attr === "srcdoc") {
						value = rewriteHtml(value, client.cookieStore);
					} else if (["srcset", "imagesrcset"].includes(attr)) {
						value = rewriteSrcset(value);
					}

					descriptor.set.call(this, value);
				},
			});
		}
	}

	self.Element.prototype.$origattrs = {};

	self.Element.prototype.getAttribute = new Proxy(
		self.Element.prototype.getAttribute,
		{
			apply(target, thisArg, argArray) {
				if (
					attrs.includes(argArray[0]) &&
					thisArg.hasAttribute(`data-${argArray[0]}`)
				) {
					return thisArg.getAttribute(`data-${argArray[0]}`);
				}

				if (attrs.includes(argArray[0]) && thisArg.$origattrs[argArray[0]]) {
					return thisArg.$origattrs[argArray[0]];
				}

				return Reflect.apply(target, thisArg, argArray);
			},
		}
	);

	self.Element.prototype.setAttribute = new Proxy(
		self.Element.prototype.setAttribute,
		{
			apply(target, thisArg, argArray) {
				if (attrs.includes(argArray[0])) {
					thisArg.$origattrs[argArray[0]] = argArray[1];
					if (["nonce", "integrity", "csp"].includes(argArray[0])) {
						return;
					} else if (
						["src", "data", "href", "action", "formaction"].includes(
							argArray[0]
						)
					) {
						argArray[1] = encodeUrl(argArray[1]);
					} else if (argArray[0] === "srcdoc") {
						// TODO: this will rewrite with the wrong url in mind for iframes!!
						argArray[1] = rewriteHtml(argArray[1], client.cookieStore);
					} else if (["srcset", "imagesrcset"].includes(argArray[0])) {
						argArray[1] = rewriteSrcset(argArray[1]);
					} else if (argArray[1] === "style") {
						argArray[1] = rewriteCss(argArray[1]);
					}
				}

				return Reflect.apply(target, thisArg, argArray);
			},
		}
	);

	const innerHTML = Object.getOwnPropertyDescriptor(
		self.Element.prototype,
		"innerHTML"
	);

	Object.defineProperty(self.Element.prototype, "innerHTML", {
		set(value) {
			if (this instanceof self.HTMLScriptElement) {
				value = rewriteJs(value);
			} else if (this instanceof self.HTMLStyleElement) {
				value = rewriteCss(value);
			} else {
				value = rewriteHtml(value, client.cookieStore);
			}

			return innerHTML.set.call(this, value);
		},
	});

	client.Trap("HTMLIFrameElement.prototype.contentWindow", {
		get(ctx) {
			const realwin = ctx.get() as Window;

			if (ScramjetClient.SCRAMJET in realwin.self) {
				return realwin.self[ScramjetClient.SCRAMJET].windowProxy;
			} else {
				// hook the iframe
				const newclient = new ScramjetClient(realwin.self);
				newclient.hook();

				return newclient.windowProxy;
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
			return self[config.rewritefn](ctx.get());
		},
	});
}

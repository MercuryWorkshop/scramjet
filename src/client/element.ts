import { client } from ".";
import { decodeUrl } from "../shared/rewriters/url";
import {
	encodeUrl,
	rewriteCss,
	rewriteHtml,
	rewriteJs,
	rewriteSrcset,
} from "./shared";
import { documentProxy } from "./window";

if ("window" in self) {
	const attrObject = {
		nonce: [HTMLElement],
		integrity: [HTMLScriptElement, HTMLLinkElement],
		csp: [HTMLIFrameElement],
		src: [
			HTMLImageElement,
			HTMLMediaElement,
			HTMLIFrameElement,
			HTMLEmbedElement,
			HTMLScriptElement,
		],
		href: [HTMLAnchorElement, HTMLLinkElement],
		data: [HTMLObjectElement],
		action: [HTMLFormElement],
		formaction: [HTMLButtonElement, HTMLInputElement],
		srcdoc: [HTMLIFrameElement],
		srcset: [HTMLImageElement, HTMLSourceElement],
		imagesrcset: [HTMLLinkElement],
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
						value = rewriteHtml(value);
					} else if (["srcset", "imagesrcset"].includes(attr)) {
						value = rewriteSrcset(value);
					}

					descriptor.set.call(this, value);
				},
			});
		}
	}

	declare global {
		interface Element {
			$origattrs: Record<string, string>;
		}
	}

	Element.prototype.$origattrs = {};

	Element.prototype.getAttribute = new Proxy(Element.prototype.getAttribute, {
		apply(target, thisArg, argArray) {
			if (attrs.includes(argArray[0]) && thisArg.$origattrs[argArray[0]]) {
				return thisArg.$origattrs[argArray[0]];
			}

			return Reflect.apply(target, thisArg, argArray);
		},
	});

	Element.prototype.setAttribute = new Proxy(Element.prototype.setAttribute, {
		apply(target, thisArg, argArray) {
			if (attrs.includes(argArray[0])) {
				thisArg.$origattrs[argArray[0]] = argArray[1];
				if (["nonce", "integrity", "csp"].includes(argArray[0])) {
					return;
				} else if (
					["src", "data", "href", "action", "formaction"].includes(argArray[0])
				) {
					argArray[1] = encodeUrl(argArray[1]);
				} else if (argArray[0] === "srcdoc") {
					argArray[1] = rewriteHtml(argArray[1]);
				} else if (["srcset", "imagesrcset"].includes(argArray[0])) {
					argArray[1] = rewriteSrcset(argArray[1]);
				} else if (argArray[1] === "style") {
					argArray[1] = rewriteCss(argArray[1]);
				}
			}

			return Reflect.apply(target, thisArg, argArray);
		},
	});

	const innerHTML = Object.getOwnPropertyDescriptor(
		Element.prototype,
		"innerHTML"
	);

	Object.defineProperty(Element.prototype, "innerHTML", {
		set(value) {
			if (this instanceof HTMLScriptElement) {
				value = rewriteJs(value);
			} else if (this instanceof HTMLStyleElement) {
				value = rewriteCss(value);
			} else {
				value = rewriteHtml(value);
			}

			return innerHTML.set.call(this, value);
		},
	});

	for (const target of [Node.prototype, MutationObserver.prototype, document]) {
		for (const prop in target) {
			try {
				if (typeof target[prop] === "function") {
					client.RawProxy(target, prop, {
						apply(ctx) {
							for (const i in ctx.args) {
								if (ctx.args[i] === documentProxy) ctx.args[i] = document;
							}
						},
					});
				}
			} catch (e) {}
		}
	}
}

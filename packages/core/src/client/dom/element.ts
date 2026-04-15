import { htmlRules } from "@/shared/htmlRules";
import {
	String,
	Array_from,
	TextEncoder_encode,
	btoa,
	Object_keys,
	Object_defineProperty,
	atob,
} from "@/shared/snapshot";
import { rewriteCss, unrewriteCss } from "@rewriters/css";
import { rewriteHtml, unrewriteHtml } from "@rewriters/html";
import { rewriteJs } from "@rewriters/js";
import { unrewriteUrl } from "@rewriters/url";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
import { isHtmlMimeType } from "@/shared/mime";
import { ForeignContext } from "@/shared/rewriters/html";

function bytesToBase64(bytes: Uint8Array) {
	const binString = Array_from(bytes, (byte) =>
		String.fromCodePoint(byte)
	).join("");

	return btoa(binString);
}

export function foreignContextForElement(
	client: ScramjetClient,
	element: Element
): ForeignContext {
	if (client.box.instanceof(element, "SVGElement")) return "svg";
	if (client.box.instanceof(element, "MathMLElement")) return "math";
	return undefined;
}

// NOTE: NOT INCLUSIVE OF THE CURRENT ELEMENT
export function insideForeignContext(
	client: ScramjetClient,
	element: Element | null
): ForeignContext {
	let current: Element | null = element.parentElement;

	while (current) {
		const context = foreignContextForElement(client, current);
		if (context) return context;
		// EXPLICITLY an html context, don't go up further
		if (client.box.instanceof(current, "SVGForeignObjectElement"))
			return undefined;
		current = current.parentElement;
	}

	return undefined;
}

export default function (client: ScramjetClient, self: typeof window) {
	const attrObject = {
		nonce: [self.HTMLElement],
		integrity: [self.HTMLScriptElement, self.HTMLLinkElement],
		csp: [self.HTMLIFrameElement],
		credentialless: [self.HTMLIFrameElement],
		src: [
			self.HTMLImageElement,
			self.HTMLMediaElement,
			self.HTMLIFrameElement,
			self.HTMLFrameElement,
			self.HTMLEmbedElement,
			self.HTMLScriptElement,
			self.HTMLSourceElement,
		],
		href: [self.HTMLAnchorElement, self.HTMLLinkElement],
		data: [self.HTMLObjectElement],
		action: [self.HTMLFormElement],
		formaction: [self.HTMLButtonElement, self.HTMLInputElement],
		srcdoc: [self.HTMLIFrameElement],
		poster: [self.HTMLVideoElement],
		imagesrcset: [self.HTMLLinkElement],
	};

	const urlinterfaces = [
		self.HTMLAnchorElement.prototype,
		self.HTMLAreaElement.prototype,
	];
	const originalhrefs = [
		client.natives.call(
			"Object.getOwnPropertyDescriptor",
			null,
			self.HTMLAnchorElement.prototype,
			"href"
		),
		client.natives.call(
			"Object.getOwnPropertyDescriptor",
			null,
			self.HTMLAreaElement.prototype,
			"href"
		),
	];

	const attrs = Object_keys(attrObject);

	for (const attr of attrs) {
		for (const element of attrObject[attr]) {
			const descriptor = client.natives.call(
				"Object.getOwnPropertyDescriptor",
				null,
				element.prototype,
				attr
			);
			Object_defineProperty(element.prototype, attr, {
				get() {
					if (["src", "data", "href", "action", "formaction"].includes(attr)) {
						return unrewriteUrl(descriptor.get.call(this), client.context);
					}

					return descriptor.get.call(this);
				},

				set(value) {
					// if (
					// 	this.tagName === "IFRAME" &&
					// 	attr === "src" &&
					// 	value === "about:blank"
					// ) {
					// 	this.setAttribute("srcdoc", "");
					// 	return;
					// }
					return this.setAttribute(attr, value);
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

					const url = new URL(unrewriteUrl(href, client.context));

					return url[prop];
				},
			});
		}
	}

	client.Trap("Node.prototype.baseURI", {
		get(ctx) {
			const node = ctx.this as Node;
			const doc = client.box.instanceof(node, "Document")
				? (node as Document)
				: node.ownerDocument;
			const base = doc?.querySelector("base[href]") as HTMLBaseElement | null;

			if (base) {
				const href = base.getAttribute("href") || base.href;
				if (href) return new URL(href, client.url.href).href;
			}

			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Proxy("Element.prototype.getAttribute", {
		apply(ctx) {
			const [name] = ctx.args;

			if (name.startsWith("scramjet-attr")) {
				return ctx.return(null);
			}

			if (
				client.natives.call(
					"Element.prototype.hasAttribute",
					ctx.this,
					`scramjet-attr-${name}`
				)
			) {
				const attrib = ctx.fn.call(ctx.this, `scramjet-attr-${name}`);
				if (attrib === null) return ctx.return("");

				return ctx.return(attrib);
			}
		},
	});

	client.Proxy("Element.prototype.getAttributeNames", {
		apply(ctx) {
			const attrNames = ctx.call() as string[];
			const cleaned = attrNames.filter(
				(attr) => !attr.startsWith("scramjet-attr")
			);

			ctx.return(cleaned);
		},
	});

	client.Proxy("Element.prototype.getAttributeNode", {
		apply(ctx) {
			if (String(ctx.args[0]).startsWith("scramjet-attr"))
				return ctx.return(null);
		},
	});

	client.Proxy("Element.prototype.hasAttribute", {
		apply(ctx) {
			if (String(ctx.args[0]).startsWith("scramjet-attr"))
				return ctx.return(false);
		},
	});

	client.Proxy("Element.prototype.setAttribute", {
		apply(ctx) {
			const [name, value] = ctx.args;

			const ruleList = htmlRules.find((rule) => {
				const r = rule[name.toLowerCase()];
				if (!r) return false;
				if (r === "*") return true;
				if (typeof r === "function") return false; // this can't happen but ts

				return r.includes(ctx.this.tagName.toLowerCase());
			});

			if (ruleList) {
				const ret = ruleList.fn(value, client.context, client.meta);
				if (ret == null) {
					client.natives.call(
						"Element.prototype.removeAttribute",
						ctx.this,
						name
					);
					ctx.return(undefined);

					return;
				}
				ctx.args[1] = ret;
				ctx.fn.call(ctx.this, `scramjet-attr-${ctx.args[0]}`, value);
			}
		},
	});

	// i actually need to do something with this
	client.Proxy("Element.prototype.setAttributeNode", {
		apply(_ctx) {},
	});

	client.Proxy("Element.prototype.setAttributeNS", {
		apply(ctx) {
			const [_namespace, name, value] = ctx.args;

			const ruleList = htmlRules.find((rule) => {
				const r = rule[name.toLowerCase()];
				if (!r) return false;
				if (r === "*") return true;
				if (typeof r === "function") return false; // this can't happen but ts

				return r.includes(ctx.this.tagName.toLowerCase());
			});

			if (ruleList) {
				ctx.args[2] = ruleList.fn(value, client.context, client.meta);
				client.natives.call(
					"Element.prototype.setAttribute",
					ctx.this,
					`scramjet-attr-${ctx.args[1]}`,
					value
				);
			}
		},
	});

	// this is separate from the regular href handlers because it returns an SVGAnimatedString
	client.Trap("SVGAnimatedString.prototype.baseVal", {
		get(ctx) {
			const href = ctx.get() as string;
			if (!href) return href;

			return unrewriteUrl(href, client.context);
		},
		set(ctx, val: string) {
			ctx.set(client.rewriteUrl(val));
		},
	});
	client.Trap("SVGAnimatedString.prototype.animVal", {
		get(ctx) {
			const href = ctx.get() as string;
			if (!href) return href;

			return unrewriteUrl(href, client.context);
		},
		// it has no setter
	});

	client.Proxy("Element.prototype.removeAttribute", {
		apply(ctx) {
			if (String(ctx.args[0]).startsWith("scramjet-attr"))
				return ctx.return(undefined);
			if (
				client.natives.call(
					"Element.prototype.hasAttribute",
					ctx.this,
					ctx.args[0]
				)
			) {
				ctx.fn.call(ctx.this, `scramjet-attr-${ctx.args[0]}`);
			}
		},
	});

	client.Proxy("Element.prototype.toggleAttribute", {
		apply(ctx) {
			if (String(ctx.args[0]).startsWith("scramjet-attr"))
				return ctx.return(false);
			if (
				client.natives.call(
					"Element.prototype.hasAttribute",
					ctx.this,
					ctx.args[0]
				)
			) {
				ctx.fn.call(ctx.this, `scramjet-attr-${ctx.args[0]}`);
			}
		},
	});

	client.Trap("Element.prototype.innerHTML", {
		set(ctx, value: string) {
			let newval;
			if (
				client.box.instanceof(ctx.this, "HTMLScriptElement") &&
				/(application|text)\/javascript|module|undefined/.test(ctx.this.type)
			) {
				newval = rewriteJs(
					value,
					"(anonymous script element)",
					client.context,
					client.meta
				);
				client.natives.call(
					"Element.prototype.setAttribute",
					ctx.this,
					"scramjet-attr-script-source-src",
					bytesToBase64(TextEncoder_encode(newval))
				);
			} else if (client.box.instanceof(ctx.this, "HTMLStyleElement")) {
				newval = rewriteCss(value, client.context, client.meta);
			} else {
				try {
					newval = rewriteHtml(value, client.context, client.meta, {
						loadScripts: false,
						inline: true,
						source: client.url.href,
						apisource: "set Element.prototype.innerHTML",
						foreignContext: foreignContextForElement(client, ctx.this),
					});
				} catch {
					newval = value;
				}
			}

			ctx.set(newval);
		},
		get(ctx) {
			if (client.box.instanceof(ctx.this, "HTMLScriptElement")) {
				const scriptSource = client.natives.call(
					"Element.prototype.getAttribute",
					ctx.this,
					"scramjet-attr-script-source-src"
				);

				if (scriptSource) {
					return atob(scriptSource);
				}

				return ctx.get();
			}
			if (client.box.instanceof(ctx.this, "HTMLStyleElement")) {
				return ctx.get();
			}

			return unrewriteHtml(ctx.get());
		},
	});

	client.Trap("Node.prototype.textContent", {
		set(ctx, value: string) {
			// TODO: box the instanceofs
			if (
				client.box.instanceof(ctx.this, "HTMLScriptElement") &&
				/(application|text)\/javascript|module|undefined/.test(ctx.this.type)
			) {
				const newval: string = rewriteJs(
					value,
					"(anonymous script element)",
					client.context,
					client.meta
				) as string;
				client.natives.call(
					"Element.prototype.setAttribute",
					ctx.this,
					"scramjet-attr-script-source-src",
					bytesToBase64(TextEncoder_encode(newval))
				);

				return ctx.set(newval);
			} else if (client.box.instanceof(ctx.this, "HTMLStyleElement")) {
				return ctx.set(rewriteCss(value, client.context, client.meta));
			} else {
				return ctx.set(value);
			}
		},
		get(ctx) {
			if (client.box.instanceof(ctx.this, "HTMLScriptElement")) {
				const scriptSource = client.natives.call(
					"Element.prototype.getAttribute",
					ctx.this,
					"scramjet-attr-script-source-src"
				);

				if (scriptSource) {
					return atob(scriptSource);
				}

				return ctx.get();
			}
			if (client.box.instanceof(ctx.this, "HTMLStyleElement")) {
				return unrewriteCss(ctx.get() as string);
			}

			return ctx.get();
		},
	});

	client.Trap("Element.prototype.outerHTML", {
		set(ctx, value: string) {
			ctx.set(
				rewriteHtml(value, client.context, client.meta, {
					loadScripts: false,
					inline: true,
					source: client.url.href,
					apisource: "set Element.prototype.outerHTML",
				})
			);
		},
		get(ctx) {
			return unrewriteHtml(ctx.get());
		},
	});

	client.Proxy("Element.prototype.setHTMLUnsafe", {
		apply(ctx) {
			try {
				ctx.args[0] = rewriteHtml(ctx.args[0], client.context, client.meta, {
					loadScripts: false,
					inline: true,
					source: client.url.href,
					apisource: "set Element.prototype.setHTMLUnsafe",
					foreignContext: foreignContextForElement(client, ctx.this),
				});
			} catch {}
		},
	});

	client.Proxy("Element.prototype.getHTML", {
		apply(ctx) {
			ctx.return(unrewriteHtml(ctx.call()));
		},
	});

	client.Proxy("Element.prototype.insertAdjacentHTML", {
		apply(ctx) {
			const html = String(ctx.args[1]);
			ctx.args[1] = rewriteHtml(html, client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "set Element.prototype.insertAdjacentHTML",
				foreignContext: foreignContextForElement(client, ctx.this),
			});
		},
	});

	// TODO: this needs to be done for all insert methods
	// client.Proxy(["Element.prototype.appendChild", "Element.prototype.append"], {
	// 	apply(ctx) {
	// 		if (ctx.this instanceof self.HTMLStyleElement) {
	// 			for (const node of ctx.args) {
	// 				if (node instanceof self.Text) {
	// 					node.data = rewriteCss(
	// 						ctx.args[0].data,
	// 						client.context,
	// 						client.meta
	// 					);
	// 				}
	// 			}
	// 		} else if (ctx.this instanceof self.HTMLScriptElement) {
	// 			for (const node of ctx.args) {
	// 				if (node instanceof self.Text) {
	// 					const newval: string = rewriteJs(
	// 						node.data,
	// 						"(anonymous script element)",
	// 						client.context,
	// 						client.meta
	// 					) as string;
	// 					client.natives.call(
	// 						"Element.prototype.setAttribute",
	// 						ctx.this,
	// 						"scramjet-attr-script-source-src",
	// 						bytesToBase64(encoder.encode(newval))
	// 					);
	// 					node.data = newval;
	// 				}
	// 			}
	// 		}
	// 	},
	// });

	client.Proxy("Audio", {
		construct(ctx) {
			if (ctx.args[0]) ctx.args[0] = client.rewriteUrl(ctx.args[0]);
		},
	});
	client.Proxy("Text.prototype.appendData", {
		apply(ctx) {
			if (ctx.this.parentElement?.tagName === "STYLE") {
				ctx.args[0] = rewriteCss(ctx.args[0], client.context, client.meta);
			}
		},
	});

	client.Proxy("Text.prototype.insertData", {
		apply(ctx) {
			if (ctx.this.parentElement?.tagName === "STYLE") {
				ctx.args[1] = rewriteCss(ctx.args[1], client.context, client.meta);
			}
		},
	});

	client.Proxy("Text.prototype.replaceData", {
		apply(ctx) {
			if (ctx.this.parentElement?.tagName === "STYLE") {
				ctx.args[2] = rewriteCss(ctx.args[2], client.context, client.meta);
			}
		},
	});

	client.Trap("Text.prototype.wholeText", {
		get(ctx) {
			if (ctx.this.parentElement?.tagName === "STYLE") {
				return unrewriteCss(ctx.get() as string);
			}

			return ctx.get();
		},
		set(ctx, v) {
			if (ctx.this.parentElement?.tagName === "STYLE") {
				return ctx.set(rewriteCss(v as string, client.context, client.meta));
			}

			return ctx.set(v);
		},
	});

	client.Trap(
		[
			"HTMLIFrameElement.prototype.contentWindow",
			"HTMLFrameElement.prototype.contentWindow",
			"HTMLObjectElement.prototype.contentWindow",
			"HTMLEmbedElement.prototype.contentWindow",
		],
		{
			get(ctx) {
				if (client.meta.base.origin === "https://accounts.google.com") {
					// botguard bullshittery
					return null;
				}

				const realwin = ctx.get() as Window;
				if (!realwin) return realwin;

				try {
					if (!(SCRAMJETCLIENT in realwin)) {
						// hook the iframe before the client can start to steal globals out of it
						client.init.hookSubcontext(realwin, ctx.this);
					}
				} catch {
					// cross-origin iframe, can't do anything here
					return realwin;
				}

				return realwin;
			},
		}
	);

	client.Trap(
		[
			"HTMLIFrameElement.prototype.contentDocument",
			"HTMLFrameElement.prototype.contentDocument",
			"HTMLObjectElement.prototype.contentDocument",
			"HTMLEmbedElement.prototype.contentDocument",
		],
		{
			get(ctx) {
				const realwin = client.descriptors.get(
					`${ctx.this.constructor.name}.prototype.contentWindow`,
					ctx.this
				);
				if (!realwin) return realwin;

				if (!(SCRAMJETCLIENT in realwin)) {
					client.init.hookSubcontext(realwin, ctx.this);
				}

				return realwin.document;
			},
		}
	);

	client.Proxy(
		[
			"HTMLIFrameElement.prototype.getSVGDocument",
			"HTMLObjectElement.prototype.getSVGDocument",
			"HTMLEmbedElement.prototype.getSVGDocument",
		],
		{
			apply(ctx) {
				const doc = ctx.call();
				if (doc) {
					// we trap the contentDocument, this is really the scramjet version
					return ctx.return(ctx.this.contentDocument);
				}
			},
		}
	);

	client.Proxy("DOMParser.prototype.parseFromString", {
		apply(ctx) {
			const html = String(ctx.args[0]);
			const mime = String(ctx.args[1]);
			// TODO: what do we do if it's xml/svg?
			if (!isHtmlMimeType(mime)) return;
			ctx.args[0] = rewriteHtml(html, client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "DOMParser.prototype.parseFromString",
			});
		},
	});
}

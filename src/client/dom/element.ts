import { SCRAMJETCLIENT } from "../../symbols";
import { ScramjetClient } from "../client";
import { nativeGetOwnPropertyDescriptor } from "../natives";
import { unrewriteUrl, htmlRules, unrewriteHtml } from "../../shared";
import { rewriteCss, rewriteHtml, rewriteJs } from "../../shared";

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
		href: [
			self.HTMLAnchorElement,
			self.HTMLLinkElement,
			self.SVGUseElement,
			self.SVGImageElement,
		],
		data: [self.HTMLObjectElement],
		action: [self.HTMLFormElement],
		formaction: [self.HTMLButtonElement, self.HTMLInputElement],
		srcdoc: [self.HTMLIFrameElement],
		srcset: [self.HTMLImageElement, self.HTMLSourceElement],
		poster: [self.HTMLVideoElement],
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
						return unrewriteUrl(descriptor.get.call(this));
					}

					return descriptor.get.call(this);
				},

				set(value) {
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

					const url = new URL(unrewriteUrl(href));

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
				return new URL(base.href, client.url.origin).href;
			}

			return client.url.origin;
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
				client.natives["Element.prototype.hasAttribute"].call(
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

	client.Proxy("Element.prototype.hasAttribute", {
		apply(ctx) {
			if (ctx.args[0].startsWith("scramjet-attr")) return ctx.return(false);
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
				ctx.args[1] = ruleList.fn(value, client.meta, client.cookieStore);
				ctx.fn.call(ctx.this, `scramjet-attr-${ctx.args[0]}`, value);
			}
		},
	});

	// i actually need to do something with this
	client.Proxy("Element.prototype.setAttributeNode", {
		apply(ctx) {},
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
				ctx.args[2] = ruleList.fn(value, client.meta, client.cookieStore);
				client.natives["Element.prototype.setAttribute"].call(
					ctx.this,
					`scramjet-attr-${ctx.args[1]}`,
					value
				);
			}
		},
	});

	client.Proxy("Element.prototype.removeAttribute", {
		apply(ctx) {
			if (ctx.args[0].startsWith("scramjet-attr")) return ctx.return(undefined);
		},
	});

	client.Proxy("Element.prototype.toggleAttribute", {
		apply(ctx) {
			if (ctx.args[0].startsWith("scramjet-attr")) return ctx.return(false);
		},
	});

	client.Trap("Element.prototype.innerHTML", {
		set(ctx, value: string) {
			let newval;
			if (ctx.this instanceof self.HTMLScriptElement) {
				newval = rewriteJs(value, "(anonymous script element)", client.meta);
			} else if (ctx.this instanceof self.HTMLStyleElement) {
				newval = rewriteCss(value, client.meta);
			} else {
				try {
					newval = rewriteHtml(value, client.cookieStore, client.meta);
				} catch {
					newval = value;
				}
			}

			ctx.set(newval);
		},
		get(ctx) {
			if (ctx.this instanceof self.HTMLScriptElement) {
				const scriptSource = client.natives[
					"Element.prototype.getAttribute"
				].call(ctx.this, "scramjet-attr-script-source-src");

				if (scriptSource) {
					return atob(scriptSource);
				}

				return ctx.get();
			}
			if (ctx.this instanceof self.HTMLStyleElement) {
				return ctx.get();
			}

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

	client.Proxy("Element.prototype.setHTMLUnsafe", {
		apply(ctx) {
			try {
				ctx.args[0] = rewriteHtml(
					ctx.args[0],
					client.cookieStore,
					client.meta,
					false
				);
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
			if (ctx.args[1])
				try {
					ctx.args[1] = rewriteHtml(
						ctx.args[1],
						client.cookieStore,
						client.meta,
						false
					);
				} catch {}
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
				const realwin = ctx.get() as Window;
				if (!realwin) return realwin;

				if (SCRAMJETCLIENT in realwin) {
					return realwin[SCRAMJETCLIENT].globalProxy;
				} else {
					// hook the iframe
					const newclient = new ScramjetClient(realwin);
					newclient.hook();

					return newclient.globalProxy;
				}
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
				const contentwindow =
					client.descriptors[
						`${ctx.this.constructor.name}.prototype.contentWindow`
					].get;
				const realwin = contentwindow.apply(ctx.this);
				if (!realwin) return realwin;

				if (SCRAMJETCLIENT in realwin) {
					return realwin[SCRAMJETCLIENT].documentProxy;
				} else {
					const newclient = new ScramjetClient(realwin);
					newclient.hook();

					return newclient.documentProxy;
				}
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
					return ctx.return(ctx.this.contentDocument);
				}
			},
		}
	);

	client.Trap("TreeWalker.prototype.currentNode", {
		get(ctx) {
			return ctx.get();
		},
		set(ctx, value) {
			if (value === client.documentProxy) {
				return ctx.set(self.document);
			}

			return ctx.set(value);
		},
	});

	client.Proxy("Document.prototype.open", {
		apply(ctx) {
			const doc = ctx.call() as Document;

			const scram: ScramjetClient = doc[SCRAMJETCLIENT];
			if (!scram) return ctx.return(doc); // ??

			return ctx.return(scram.documentProxy);
		},
	});

	client.Trap("Node.prototype.ownerDocument", {
		get(ctx) {
			const doc = ctx.get() as Document | null;
			if (!doc) return null;

			const scram: ScramjetClient = doc[SCRAMJETCLIENT];
			if (!scram) return doc; // ??

			return scram.documentProxy;
		},
	});

	client.Trap(
		[
			"Node.prototype.parentNode",
			"Node.prototype.parentElement",
			"Node.prototype.previousSibling",
			"Node.prototype.nextSibling",
			"Range.prototype.commonAncestorContainer",
			"AbstractRange.prototype.endContainer",
			"AbstractRange.prototype.startContainer",
		],
		{
			get(ctx) {
				const n = ctx.get() as Node;
				if (!(n instanceof Document)) return n;

				const scram: ScramjetClient = n[SCRAMJETCLIENT];
				if (!scram) return n; // ??

				return scram.documentProxy;
			},
		}
	);

	client.Proxy("Node.prototype.getRootNode", {
		apply(ctx) {
			const n = ctx.call() as Node;
			if (!(n instanceof Document)) return ctx.return(n);

			const scram: ScramjetClient = n[SCRAMJETCLIENT];
			if (!scram) return ctx.return(n); // ??

			return ctx.return(scram.documentProxy);
		},
	});

	client.Proxy(
		[
			"DOMParser.prototype.parseFromString",
			"Document.prototype.parseHTMLUnsafe",
		],
		{
			apply(ctx) {
				if (ctx.args[1] === "text/html") {
					try {
						ctx.args[0] = rewriteHtml(
							ctx.args[0],
							client.cookieStore,
							client.meta,
							false
						);
					} catch {}
				}
			},
		}
	);
}

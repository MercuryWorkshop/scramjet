import { decodeUrl } from "../shared/rewriters/url";
import { encodeUrl, rewriteCss, rewriteHtml, rewriteJs, rewriteSrcset } from "./shared";

const attrObject = {
    "nonce": [HTMLElement],
    "integrity": [HTMLScriptElement, HTMLLinkElement],
    "csp": [HTMLIFrameElement],
    "src": [HTMLImageElement, HTMLMediaElement, HTMLIFrameElement, HTMLEmbedElement, HTMLScriptElement],
    "href": [HTMLAnchorElement, HTMLLinkElement],
    "data": [HTMLObjectElement],
    "action": [HTMLFormElement],
    "formaction": [HTMLButtonElement, HTMLInputElement],
    "srcdoc": [HTMLIFrameElement],
    "srcset": [HTMLImageElement, HTMLSourceElement],
    "imagesrcset": [HTMLLinkElement]
}

const attrs = Object.keys(attrObject);

for (const attr of attrs) {
    for (const element of attrObject[attr]) {
        const descriptor = Object.getOwnPropertyDescriptor(element.prototype, attr);
        Object.defineProperty(element.prototype, attr, {
            get() {
                if (/src|href|data|action|formaction/.test(attr)) {
                    return decodeUrl(descriptor.get.call(this));
                }

                if (this.__origattrs[attr]) {
                    return this.__origattrs[attr];
                }

                return descriptor.get.call(this);
            },

            set(value) {
                this.__origattrs[attr] = value;

                if (/nonce|integrity|csp/.test(attr)) {
                    return;
                } else if (/src|href|data|action|formaction/.test(attr)) {
                    // @ts-expect-error
                    if (value instanceof TrustedScriptURL) {
                        return;
                    }

                    value = encodeUrl(value);
                } else if (attr === "srcdoc") {
                    value = rewriteHtml(value);
                } else if (/(image)?srcset/.test(attr)) {
                    value = rewriteSrcset(value);
                }

                descriptor.set.call(this, value);
            },
        });
    }
}

declare global {
    interface Element {
        __origattrs: Record<string, string>;
    }
}

Element.prototype.__origattrs = {};

Element.prototype.getAttribute = new Proxy(Element.prototype.getAttribute, {
    apply(target, thisArg, argArray) {
        if (attrs.includes(argArray[0]) && thisArg.__origattrs[argArray[0]]) {
            return thisArg.__origattrs[argArray[0]];
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

Element.prototype.setAttribute = new Proxy(Element.prototype.setAttribute, {
    apply(target, thisArg, argArray) {
        if (attrs.includes(argArray[0])) {
            thisArg.__origattrs[argArray[0]] = argArray[1];
            if (/nonce|integrity|csp/.test(argArray[0])) {
                return;
            } else if (/src|href|data|action|formaction/.test(argArray[0])) {
                argArray[1] = encodeUrl(argArray[1]);
            } else if (argArray[0] === "srcdoc") {
                argArray[1] = rewriteHtml(argArray[1]);
            } else if (/(image)?srcset/.test(argArray[0])) {
                argArray[1] = rewriteSrcset(argArray[1]);
            } else if (argArray[1] === "style") {
                argArray[1] = rewriteCss(argArray[1]);
            }
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");

Object.defineProperty(Element.prototype, "innerHTML", {
    set(value) {
        // @ts-expect-error
        if (this instanceof HTMLScriptElement && !(value instanceof TrustedScript)) {
            value = rewriteJs(value);
        } else if (this instanceof HTMLStyleElement) {
            value = rewriteCss(value);
            // @ts-expect-error
        } else if (!(value instanceof TrustedHTML)) {
            value = rewriteHtml(value);
        }

        return innerHTML.set.call(this, value);
    },
})

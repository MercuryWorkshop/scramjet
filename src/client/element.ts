import { encodeUrl, rewriteCss, rewriteJs, rewriteSrcset } from "../bundle";
import { rewriteHtml } from "../html";

// object
// iframe
// embed
// link
// style
// script
// img
// source
// form
// meta
// area
// base
// body
// input
// audio
// button
// track
// video

const attribs = {
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
    "imagesrcset": [HTMLLinkElement],
    "style": [HTMLElement]
}

Object.keys(attribs).forEach((attrib: string) => {
    attribs[attrib].forEach((element) => {
        const descriptor = Object.getOwnPropertyDescriptor(element.prototype, attrib);
        Object.defineProperty(element.prototype, attrib, {
            get() {
                return this.dataset[`${attrib}`];
            },

            set(value) {
                this.dataset[`${attrib}`] = value;
                if (/nonce|integrity|csp/.test(attrib)) {
                    this.removeAttribute(attrib);
                } else if (/src|href|data|action|formaction/.test(attrib)) {
                    // @ts-expect-error
                    // TrustedScriptURL does not exist as a type yet, but it is a real thing
                    if (value instanceof TrustedScriptURL) {
                        return;
                    }

                    value = encodeUrl(value);
                } else if (attrib === "srcdoc") {
                    // @ts-ignore
                    // This needs to be ignored because I'm bad at TypeScript
                    
                    value = rewriteHtml(value).documentElement.innerHTML;
                } else if (/(image)?srcset/.test(attrib)) {
                    value = rewriteSrcset(value);
                } else if (attrib === "style") {
                    value = rewriteCss(value);
                }

                descriptor.set.call(this, value);
            },
        });
    })
});

Element.prototype.getAttribute = new Proxy(Element.prototype.getAttribute, {
    apply(target, thisArg, argArray) {
        if (Object.keys(attribs).includes(argArray[0]) && thisArg.dataset[`${argArray[0]}`]) {
            return thisArg.dataset[`${argArray[0]}`];
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

Element.prototype.setAttribute = new Proxy(Element.prototype.setAttribute, {
    apply(target, thisArg, argArray) {
        if (Object.keys(attribs).includes(argArray[0])) {
            thisArg.dataset[`${argArray[0]}`] = argArray[1];
            if (/nonce|integrity|csp/.test(argArray[0])) {
                return;
            } else if (/src|href|data|action|formaction/.test(argArray[0])) {
                argArray[1] = encodeUrl(argArray[1]);
            } else if (argArray[0] === "srcdoc") {
                // @ts-ignore
                argArray[1] = rewriteHtml(argArray[1]).documentElement.innerHTML;
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

Object.defineProperty(HTMLElement.prototype, "innerHTML", {
    set(value) {
        if (this instanceof HTMLScriptElement) {
            // @ts-expect-error
            // TrustedScript does not exist as a type yet, but it is a real thing
            if (!(value instanceof TrustedScript)) {
                value = rewriteJs(value);
            }
        } else if (this instanceof HTMLStyleElement) {
            value = rewriteCss(value);
        } else {
            // @ts-expect-error
            // TrustedHTML does not exist as a type, but it is a real thing
            if (!(value instanceof TrustedHTML)) {
                // @ts-ignore
                value = rewriteHtml(value).documentElement.innerHTML;
            }
        }

        innerHTML.set.call(this, value);
    },
});

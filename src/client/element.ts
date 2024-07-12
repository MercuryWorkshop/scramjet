import { encodeUrl, rewriteCss, rewriteHtml, rewriteJs, rewriteSrcset } from "../bundle";

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
                return this.dataset[attrib];
            },

            set(value) {
                this.dataset[attrib] = value;
                if (/nonce|integrity|csp/.test(attrib)) {
                    this.removeAttribute(attrib);
                } else if (/src|href|data|action|formaction/.test(attrib)) {
                    // @ts-expect-error
                    if (value instanceof TrustedScriptURL) {
                        return;
                    }

                    value = encodeUrl(value);
                } else if (attrib === "srcdoc") {
                    value = rewriteHtml(value);
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

HTMLElement.prototype.getAttribute = new Proxy(Element.prototype.getAttribute, {
    apply(target, thisArg, argArray) {
        console.log(thisArg);
        if (Object.keys(attribs).includes(argArray[0])) {
            argArray[0] = `data-${argArray[0]}`;
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

// setAttribute proxy is currently broken

HTMLElement.prototype.setAttribute = new Proxy(Element.prototype.setAttribute, {
    apply(target, thisArg, argArray) {
        if (thisArg.dataset["scramjet"]) {
            return;
        }
        console.log(argArray[1])
        if (Object.keys(attribs).includes(argArray[0])) {
            thisArg.dataset[`_${argArray[0]}`] = argArray[1];
            if (/nonce|integrity|csp/.test(argArray[0])) {
                return;
            } else if (/src|href|data|action|formaction/.test(argArray[0])) {
                console.log(thisArg);
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

Object.defineProperty(HTMLElement.prototype, "innerHTML", {
    set(value) {
        if (this instanceof HTMLScriptElement) {
            // @ts-expect-error
            if (!(value instanceof TrustedScript)) {
                value = rewriteJs(value);
            }
        } else if (this instanceof HTMLStyleElement) {
            value = rewriteCss(value);
        } else {
            // @ts-expect-error
            if (!(value instanceof TrustedHTML)) {
                value = rewriteHtml(value);
            }
        }

        return innerHTML.set.call(this, value);
    },
})
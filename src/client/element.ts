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
                return descriptor.get.call(this, [this.dataset[`_${attrib}`]]);
            },

            set(value) {
                this.dataset[`_${attrib}`] = value;
                if (/nonce|integrity|csp/.test(attrib)) {
                    this.removeAttribute(attrib);
                } else if (/src|href|data|action|formaction/.test(attrib)) {
                    if (value instanceof TrustedScriptURL) {
                        return;
                    }

                    value = self.__scramjet$bundle.rewriters.url.encodeUrl(value);
                } else if (attrib === "srcdoc") {
                    value = self.__scramjet$bundle.rewriters.rewriteHtml(value);
                } else if (/(image)?srcset/.test(attrib)) {
                    value = self.__scramjet$bundle.rewriters.rewriteSrcset(value);
                } else if (attrib === "style") {
                    value = self.__scramjet$bundle.rewriters.rewriteCss(value);
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
            argArray[0] = `_${argArray[0]}`;
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

// setAttribute proxy is currently broken

HTMLElement.prototype.setAttribute = new Proxy(Element.prototype.setAttribute, {
    apply(target, thisArg, argArray) {
        if (Object.keys(attribs).includes(argArray[0])) {
            thisArg.dataset[`_${argArray[0]}`] = argArray[1];
            if (/nonce|integrity|csp/.test(argArray[0])) {
                return;
            } else if (/src|href|data|action|formaction/.test(argArray[0])) {
                console.log(thisArg);
                argArray[1] = self.__scramjet$bundle.rewriters.url.encodeUrl(argArray[1]);
            } else if (argArray[0] === "srcdoc") {
                argArray[1] = self.__scramjet$bundle.rewriters.rewriteHtml(argArray[1]);
            } else if (/(image)?srcset/.test(argArray[0])) {
                argArray[1] = self.__scramjet$bundle.rewriters.rewriteSrcset(argArray[1]);
            } else if (argArray[1] === "style") {
                argArray[1] = self.__scramjet$bundle.rewriters.rewriteCss(argArray[1]);
            }
        }

        return Reflect.apply(target, thisArg, argArray);
    },
});

const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");

Object.defineProperty(HTMLElement.prototype, "innerHTML", {
    set(value) {
        if (this instanceof HTMLScriptElement) {
            if (!(value instanceof TrustedScript)) {
                value = self.__scramjet$bundle.rewriters.rewriteJs(value);
            }
        } else if (this instanceof HTMLStyleElement) {
            value = self.__scramjet$bundle.rewriters.rewriteCss(value);
        } else {
            if (!(value instanceof TrustedHTML)) {
                value = self.__scramjet$bundle.rewriters.rewriteHtml(value);
            }
        }

        return innerHTML.set.call(this, value);
    },
})
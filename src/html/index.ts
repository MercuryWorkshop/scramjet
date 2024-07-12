// this code needs to be bundled as a separate file due to when it is ran

import { encodeUrl, rewriteCss, rewriteJs, rewriteSrcset } from "../bundle";
import Clone from "./cloner.ts";

const parser = new DOMParser();

function parseHtml(html: string) {
    return parser.parseFromString(html, "text/html");
}

function traverseParsedHtml(node: Element) {
    for (const cspAttr of ["csp", "nonce", "integrity"]) {
        if (node.hasAttribute(cspAttr)) {
            node.setAttribute("data-" + cspAttr, node.getAttribute(cspAttr));
            node.removeAttribute(cspAttr);
        }
    }

    for (const urlAttr of ["src", "href", "data", "action"]) {
        if (node.hasAttribute(urlAttr) && !node.hasAttribute("data-scramjet")) {
            const url = node.getAttribute(urlAttr);
            node.setAttribute("data-" + urlAttr, url)
            node.setAttribute(urlAttr, encodeUrl(node.getAttribute(urlAttr)));
        }
    }

    for (const srcsetAttr of ["srcset", "imagesrcset"]) {
        if (node.hasAttribute(srcsetAttr)) {
            const srcset = node.getAttribute(srcsetAttr);
            node.setAttribute("data-", srcset);
            node.setAttribute(srcsetAttr, rewriteSrcset(srcset));
        }
    }

    if (node.hasAttribute("srcdoc")) {
        const srcdoc = node.getAttribute("srcdoc");
        node.setAttribute("data-srcdoc", srcdoc);

        const rewrittenSrcdoc = rewriteHtml(srcdoc);
        node.setAttribute("srcdoc", rewrittenSrcdoc.documentElement.innerHTML);
    }

    if (node instanceof HTMLScriptElement) {
        if (node.hasAttribute("data-scramjet")) {
            return;
        }
        node.innerHTML = rewriteJs(node.textContent);
    } else if (node instanceof HTMLStyleElement) {
        node.innerHTML = rewriteCss(node.textContent);
    } else if (node instanceof HTMLHeadElement) {
        // this array is reversed because it uses node.prepend()
        for (const scramjetScript of ["client", "config", "codecs"]) {
            const script = document.createElement("script");
            script.src = self.__scramjet$config[scramjetScript];
            script.setAttribute("data-scramjet", "");
            node.prepend(script);
        }
    }

    if (node.children) {
        for (const child of node.children) {
            traverseParsedHtml(child);
        }
    }
}

export function rewriteHtml(html: string) {
    const parsedHtml = parseHtml(html);
    traverseParsedHtml(parsedHtml.documentElement);

    return parsedHtml;
}

navigator.serviceWorker.ready.then(({ active }) => {
    if (active) {
        active.postMessage("rewriteHtml");
    }
});

navigator.serviceWorker.addEventListener("message", (message) => {
    document.documentElement.replaceWith(rewriteHtml(message.data).documentElement);

    const scripts = document.querySelectorAll("script:not([data-scramjet])");

    for (const script of scripts) {
        const clone = new Clone(script);
        clone.insertCopy();
        clone.removeElement();
    }
});
import { Parser } from "htmlparser2";
import { DomHandler, hasChildren } from "domhandler";
import { hasAttrib, getAttributeValue } from "domutils";
import render from "dom-serializer";
import { encodeUrl } from "./url";
import { rewriteCss } from "./css";
import { rewriteJs } from "./js";

// html nodes to rewrite
// meta

export function rewriteHtml(html: string, origin?: string) {
    const handler = new DomHandler((err, dom) => dom);
    const parser = new Parser(handler);

    parser.write(html);
    parser.end();

    return render(traverseParsedHtml(handler.root, origin));
}

function traverseParsedHtml(node, origin?: string) {
    // apparently nonce is a global attribute so i'll just delete it at the beginning of the file
    if (hasAttrib(node, "nonce")) {
        delete node.attribs.nonce;
    }

    if (node.name === "a" && hasAttrib(node, "href")) {
        node.attribs.href = encodeUrl(node.attribs.href, origin);
    } else if (node.name === "iframe") {
        if (hasAttrib(node, "src")) {
            node.attribs.src = encodeUrl(node.attribs.src, origin);
        }

        if (hasAttrib(node, "srcdoc")) {
            node.attribs.srcdoc = rewriteHtml(node.attribs.srcdoc, origin);
        }

        if (hasAttrib(node, "csp")) {
            delete node.attribs.csp;
        }
    } else if (node.name === "link") {
        if (hasAttrib(node, "integrity")) {
            delete node.attribs.integrity;
        }

        node.attribs.href = encodeUrl(node.attribs.href, origin);

        if (hasAttrib(node, "imagesrcset")) {
            node.attribs.imagesrcset = rewriteSrcset(node.attribs.imagesrcset);
        }

        console.log(node.attribs.href)
    } else if (node.name === "style") {
        node.children[0].data = rewriteCss(node.children[0].data, origin);
    } else if (node.name === "script") {
        if (hasAttrib(node, "integrity")) {
            delete node.attribs.integrity;
        }

        if (hasAttrib(node, "type") && /(application|text)\/javascript|importmap/.test(getAttributeValue(node, "type"))) {
            if (hasAttrib(node, "src")) {
                node.attribs.src = encodeUrl(node.attribs.src, origin);
                console.log(node.attribs.src);
            }
        }

        // implement js rewriting when done
    } else if (node.name === "img" && hasAttrib(node, "src")) {
        if (hasAttrib(node, "src")) {
            node.attribs.src = encodeUrl(node.attribs.src, origin);
        }

        if (hasAttrib(node, "srcset")) {
            node.attribs.srcset = rewriteSrcset(node.attribs.srcset);
        }
    } else if (node.name === "object") {
        node.attribs.data = encodeUrl(node.attribs.data, origin);
    } else if (node.name === "embed") {
        node.attribs.src = encodeUrl(node.attribs.src, origin);
    } else if (node.name === "source") {
        if (hasAttrib(node, "src")) {
            node.attribs.src = encodeUrl(node.attribs.src, origin);
        }

        if (hasAttrib(node, "srcset")) {
            node.attribs.srcset = rewriteSrcset(node.attribs.srcset);
        }
    } else if (node.name === "form") {
        node.attribs.action = encodeUrl(node.attribs.action, origin);
    } else if (node.name === "area") {
        node.attribs.href = encodeUrl(node.attribs.href, origin);
    } else if (node.name === "base" && hasAttrib(node, "href")) {
        node.attribs.href = encodeUrl(node.attribs.href, origin);
    } else if (node.name === "input") {
        if (hasAttrib(node, "formaction")) {
            node.attribs.formaction = encodeUrl(node.attribs.formaction, origin);
        }
    } else if (node.name === "audio") {
        node.attribs.src = encodeUrl(node.attribs.src, origin);
    } else if (node.name === "button") {
        if (hasAttrib(node, "formaction")) {
            node.attribs.formaction = encodeUrl(node.attribs.formaction, origin);
        }
    } else if (node.name === "track") {
        node.attribs.src = encodeUrl(node.attribs.src, origin);
    } else if (node.name === "video") {
        node.attribs.src = encodeUrl(node.attribs.src, origin);
    } else if (node.name === "meta") {
        if (hasAttrib(node, "http-equiv") && node.attribs["http-equiv"] === "content-security-policy") {
            delete node.attribs["http-equiv"];
        }
    }

    if (node.childNodes) {
        for (const childNode in node.childNodes) {
            node.childNodes[childNode] = traverseParsedHtml(node.childNodes[childNode], origin);
        }
    }

    return node;
}

// stole from osana lmao
export function rewriteSrcset(srcset: string, origin?: string) {
    const urls = srcset.split(/ [0-9]+x,? ?/g);
    if (!urls) return "";
    const sufixes = srcset.match(/ [0-9]+x,? ?/g);
    if (!sufixes) return "";
    const rewrittenUrls = urls.map((url, i) => {
        if (url && sufixes[i]) {
            return encodeUrl(url, origin) + sufixes[i];
        }
    });

    return rewrittenUrls.join("");
}
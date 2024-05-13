import { Parser } from "htmlparser2";
import { DomHandler } from "domhandler";
import { hasAttrib } from "domutils";
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
    /* csp attributes */
    if (hasAttrib(node, "nonce")) delete node.attribs.nonce;
    if (hasAttrib(node, "integrity")) delete node.attribs.integrity;
    if (hasAttrib(node, "csp")) delete node.attribs.csp;

    /* url attributes */
    if (hasAttrib(node, "src")) node.attribs.src = encodeUrl(node.attribs.src, origin);
    if (hasAttrib(node, "href")) node.attribs.href = encodeUrl(node.attribs.href, origin);
    if (hasAttrib(node, "data")) node.attribs.data = encodeUrl(node.attribs.data, origin);
    if (hasAttrib(node, "formaction")) node.attribs.formaction = encodeUrl(node.attribs.formaction, origin);
    if (hasAttrib(node, "form")) node.attribs.action = encodeUrl(node.attribs.action, origin);

    /* other */
    if (hasAttrib(node, "srcdoc")) node.attribs.srcdoc = rewriteHtml(node.attribs.srcdoc, origin);
    if (hasAttrib(node, "srcset")) node.attribs.srcset = rewriteSrcset(node.attribs.srcset, origin);
    if (hasAttrib(node, "imagesrcset")) node.attribs.imagesrcset = rewriteSrcset(node.attribs.imagesrcset, origin);

    if (node.name === "style" && node.children[0] !== undefined) node.children[0].data = rewriteCss(node.children[0].data, origin);
    if (node.name === "script" && /(application|text)\/javascript|importmap|undefined/.test(node.attribs.type) && node.children[0] !== undefined) node.children[0].data = rewriteJs(node.children[0].data, origin);

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
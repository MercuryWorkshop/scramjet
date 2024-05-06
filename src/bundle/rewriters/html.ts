import { Parser } from "htmlparser2";
import { DomHandler } from "domhandler";
import { hasAttrib, getAttributeValue } from "domutils";
import render from "dom-serializer";
import { encodeUrl } from "./url";
import { rewriteCss } from "./css";

// html nodes to rewrite
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

export function rewriteHtml(html: string, origin?: string) {
    const handler = new DomHandler((err, dom) => dom);
    const parser = new Parser(handler);

    parser.write(html);
    parser.end();

    return render(traverseParsedHtml(handler.root, origin));
}

// typescript error hell
// the code still works but the types provided from domhandler are shit
function traverseParsedHtml(node: any, origin?: string) {
    if (node.name === "a" && hasAttrib(node, "href")) {
        node.attribs.href = encodeUrl(node.attribs.href, origin);
    } else if (node.name === "iframe") {
        if (hasAttrib(node, "src")) {
            node.attribs.src = encodeUrl(node.attribs.src, origin);
        }

        if (hasAttrib(node, "srcdoc")) {
            node.attribs.srcdoc = rewriteHtml(node.attribs.srcdoc, origin);
        }
    } else if (node.name === "link") {
        node.attribs.href = encodeUrl(node.attribs.href, origin);
        console.log(node.attribs.href)
    } else if (node.name === "style") {
        node.children[0].data = rewriteCss(node.children[0].data, origin);
    } else if (node.name === "script") {
        if (hasAttrib(node, "type") && /(application|text)\/javascript|importmap/.test(getAttributeValue(node, "type"))) {
            if (hasAttrib(node, "src")) {
                node.attribs.src = encodeUrl(node.attribs.src, origin);
                console.log(node.attribs.src);
            }
        }

        // implement js rewriting when done
    } else if (node.name === "img" && hasAttrib(node, "src")) {
        node.attribs.src = encodeUrl(node.attribs.src, origin);
    }

    if (node.childNodes) {
        for (const childNode in node.childNodes) {
            node.childNodes[childNode] = traverseParsedHtml(node.childNodes[childNode], origin);
        }
    }

    return node;
}
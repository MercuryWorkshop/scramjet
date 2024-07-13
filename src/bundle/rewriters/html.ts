import { Parser } from "htmlparser2";
import { DomHandler, Element } from "domhandler";
import { hasAttrib } from "domutils";
import render from "dom-serializer";
import { encodeUrl } from "./url";
import { rewriteCss } from "./css";
import { rewriteJs } from "./js";
import { isScramjetFile } from "../";

export function rewriteHtml(html: string, origin?: URL) {
    const handler = new DomHandler((err, dom) => dom);
    const parser = new Parser(handler);

    parser.write(html);
    parser.end();

    return render(traverseParsedHtml(handler.root, origin));
}

// i need to add the attributes in during rewriting

function traverseParsedHtml(node, origin?: URL) {
    /* csp attributes */
    for (const cspAttr of ["nonce", "integrity", "csp"]) {
        if (hasAttrib(node, cspAttr)) {
            node.attribs[`data-${cspAttr}`] = node.attribs[cspAttr];
            delete node.attribs[cspAttr];
        }
    }

    /* url attributes */
    for (const urlAttr of ["src", "href", "data", "action", "formaction"]) {
        if (hasAttrib(node, urlAttr) && !isScramjetFile(node.attribs[urlAttr])) {
            const value = node.attribs[urlAttr];
            node.attribs[`data-${urlAttr}`] = value;
            node.attribs[urlAttr] = encodeUrl(value, origin);
        }
    }
    
    /* other */
    for (const srcsetAttr of ["srcset", "imagesrcset"]) {
        if (hasAttrib(node, srcsetAttr)) {
            const value = node.attribs[srcsetAttr];
            node.attribs[`data-${srcsetAttr}`] = value;
            node.attribs[srcsetAttr] = rewriteSrcset(value, origin);
        }
    }

    if (hasAttrib(node, "srcdoc")) node.attribs.srcdoc = rewriteHtml(node.attribs.srcdoc, origin);
    if (hasAttrib(node, "style")) node.attribs.style = rewriteCss(node.attribs.style, origin);

    if (node.name === "style" && node.children[0] !== undefined) node.children[0].data = rewriteCss(node.children[0].data, origin);
    if (node.name === "script" && /(application|text)\/javascript|importmap|undefined/.test(node.attribs.type) && node.children[0] !== undefined) node.children[0].data = rewriteJs(node.children[0].data, origin);
    if (node.name === "meta" && hasAttrib(node, "http-equiv")) {
        if (node.attribs["http-equiv"] === "content-security-policy") {
            node = {};
        } else if (node.attribs["http-equiv"] === "refresh" && node.attribs.content.includes("url")) {
            const contentArray = node.attribs.content.split("url=");
            contentArray[1] = encodeUrl(contentArray[1].trim(), origin);
            node.attribs.content = contentArray.join("url=");
        }
    }

    if (node.name === "head") {
        const scramjetScripts = [];
        ["codecs", "config", "bundle", "client"].forEach((script) => {
            scramjetScripts.push(new Element("script", {
                src: self.__scramjet$config[script],
                type: "module"
            }));
        });

        node.children.unshift(...scramjetScripts);
    }

    if (node.childNodes) {
        for (const childNode in node.childNodes) {
            node.childNodes[childNode] = traverseParsedHtml(node.childNodes[childNode], origin);
        }
    }

    return node;
}

export function rewriteSrcset(srcset: string, origin?: URL) {
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
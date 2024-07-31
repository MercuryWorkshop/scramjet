import { ElementType, Parser } from "htmlparser2";
import { DomHandler, Element, Text } from "domhandler";
import { hasAttrib } from "domutils";
import render from "dom-serializer";
import { encodeUrl } from "./url";
import { rewriteCss } from "./css";
import { rewriteJs } from "./js";

export function isScramjetFile(src: string) {
	let bool = false;
	["codecs", "client", "shared", "worker"].forEach((file) => {
		if (src === self.$scramjet.config[file]) bool = true;
	});

	return bool;
}

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
	for (const urlAttr of ["src", "href", "action", "formaction", "poster"]) {
		if (
			hasAttrib(node, urlAttr) &&
			!isScramjetFile(node.attribs[urlAttr]) &&
			[
				"iframe",
				"embed",
				"script",
				"a",
				"img",
				"link",
				"object",
				"form",
				"media",
				"source",
				"video",
			].includes(node.name)
		) {
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

	if (node.name === "meta" && hasAttrib(node, "http-equiv")) {
		const content = node.attribs.content;

		const regex =
			/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

		if (regex.test(content)) {
			const url = content.match(regex)[0];

			node.attribs.content = content.replace(url, encodeUrl(url, origin));
		}
	}

	if (hasAttrib(node, "srcdoc"))
		node.attribs.srcdoc = rewriteHtml(node.attribs.srcdoc, origin);
	if (hasAttrib(node, "style"))
		node.attribs.style = rewriteCss(node.attribs.style, origin);

	if (node.name === "style" && node.children[0] !== undefined)
		node.children[0].data = rewriteCss(node.children[0].data, origin);
	if (
		node.name === "script" &&
		/(application|text)\/javascript|module|importmap|undefined/.test(
			node.attribs.type
		) &&
		node.children[0] !== undefined &&
		!node.attribs["data-scramjet"]
	) {
		let js = node.children[0].data;
		const htmlcomment = /<!--[\s\S]*?-->/g;
		js = js.replace(htmlcomment, "");
		node.children[0].data = rewriteJs(js, origin);
		console.log(node.children);
	}
	if (node.name === "meta" && hasAttrib(node, "http-equiv")) {
		if (node.attribs["http-equiv"] === "content-security-policy") {
			node = {};
		} else if (
			node.attribs["http-equiv"] === "refresh" &&
			node.attribs.content.includes("url")
		) {
			const contentArray = node.attribs.content.split("url=");
			if (contentArray[1])
				contentArray[1] = encodeUrl(contentArray[1].trim(), origin);
			node.attribs.content = contentArray.join("url=");
		}
	}

	if (node.name === "head") {
		const scripts = [];

		const codecs = new Element("script", {
			src: self.$scramjet.config["codecs"],
			"data-scramjet": "true",
		});
		const shared = new Element("script", {
			src: self.$scramjet.config["shared"],
			onload: `self.$scramjet.config = ${JSON.stringify(self.$scramjet.config)};
		self.$scramjet.codec = self.$scramjet.codecs[self.$scramjet.config.codec];`,
			"data-scramjet": "true",
		});
		const client = new Element("script", {
			src: self.$scramjet.config["client"],
			"data-scramjet": "true",
		});

		scripts.push(codecs, shared, client);

		node.children.unshift(...scripts);
	}

	if (node.childNodes) {
		for (const childNode in node.childNodes) {
			node.childNodes[childNode] = traverseParsedHtml(
				node.childNodes[childNode],
				origin
			);
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

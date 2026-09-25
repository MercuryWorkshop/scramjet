import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-shape",
		js: `
			const members = [
				["Element.prototype", ["setAttribute","getAttribute","removeAttribute","toggleAttribute","hasAttribute","getAttributeNames","setAttributeNS","getAttributeNS","removeAttributeNS","hasAttributeNS","getAttributeNode","setAttributeNode","removeAttributeNode","querySelector","querySelectorAll","matches","closest","insertAdjacentHTML","setHTMLUnsafe","getHTML","append","prepend","after","before","replaceWith","replaceChildren","insertAdjacentText","hasAttributes"]],
				["Node.prototype", ["appendChild","insertBefore","removeChild","replaceChild","cloneNode","normalize"]],
				["Document.prototype", ["querySelector","querySelectorAll","importNode","append"]],
				["CharacterData.prototype", ["appendData","insertData","deleteData","replaceData","substringData","remove","after"]],
				["Text.prototype", ["splitText"]],
				["Range.prototype", ["toString","cloneContents","extractContents","insertNode","surroundContents","createContextualFragment"]],
				["DOMTokenList.prototype", ["add","remove","toggle","replace"]],
				["NamedNodeMap.prototype", ["item","getNamedItem","getNamedItemNS","setNamedItem","setNamedItemNS","removeNamedItem","removeNamedItemNS"]],
				["DOMParser.prototype", ["parseFromString"]],
				["HTMLAnchorElement.prototype", ["toString"]],
			];
			const accessors = [
				["Element.prototype", ["innerHTML","outerHTML","attributes"]],
				["Node.prototype", ["textContent","nodeValue","nodeName","baseURI"]],
				["HTMLElement.prototype", ["innerText","outerText","nonce"]],
				["HTMLAnchorElement.prototype", ["href","pathname","host","origin","target"]],
				["HTMLImageElement.prototype", ["src","srcset","currentSrc"]],
				["HTMLScriptElement.prototype", ["src","text","type","integrity","textContent"]],
				["HTMLIFrameElement.prototype", ["src","srcdoc","sandbox","contentWindow","contentDocument"]],
				["CharacterData.prototype", ["data","length"]],
				["Attr.prototype", ["value","name","ownerElement","localName"]],
				["NamedNodeMap.prototype", ["length"]],
				["SVGAnimatedString.prototype", ["baseVal","animVal"]],
				["AbstractRange.prototype", ["startOffset","endOffset"]],
				["ShadowRoot.prototype", ["innerHTML"]],
				["HTMLLinkElement.prototype", ["href","imageSrcset"]],
				["HTMLFormElement.prototype", ["action"]],
			];
			const get = (path) => path.split(".").reduce((o, k) => o[k], window);
			const out = [];
			for (const [p, names] of members) {
				const proto = get(p);
				for (const n of names) {
					const d = Object.getOwnPropertyDescriptor(proto, n);
					if (!d) { out.push(p + "." + n + " MISSING"); continue; }
					const f = d.value;
					out.push([p + "." + n, typeof f, f && f.name, f && f.length, f && Function.prototype.toString.call(f), d.writable, d.enumerable, d.configurable, f && Object.getOwnPropertyNames(f).sort().join("/"), f && ("prototype" in f)].join("|"));
				}
			}
			for (const [p, names] of accessors) {
				const proto = get(p);
				for (const n of names) {
					const d = Object.getOwnPropertyDescriptor(proto, n);
					if (!d) { out.push(p + "." + n + " MISSING"); continue; }
					const g = d.get, s = d.set;
					out.push([p + "." + n, g && g.name, g && g.length, g && Function.prototype.toString.call(g), s && s.name, s && s.length, s && Function.prototype.toString.call(s), d.enumerable, d.configurable].join("|"));
				}
			}
			for (const l of out) assertConsistent(l.split("|")[0], l);
		`,
	}),
];

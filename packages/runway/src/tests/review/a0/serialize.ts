import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv0-ser-svg-image-outerhtml",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
			img.setAttribute("href", "https://example.test/a.png");
			svg.appendChild(img);
			document.body.appendChild(svg);
			assertEqual(img.outerHTML, '<image href="https://example.test/a.png"></image>', "svg image outerHTML");
			assertEqual(svg.innerHTML, '<image href="https://example.test/a.png"></image>', "svg innerHTML");
			assertEqual(svg.outerHTML, '<svg><image href="https://example.test/a.png"></image></svg>', "svg outerHTML: " + svg.outerHTML);
		`,
	}),
	basicTest({
		name: "rv0-ser-svg-empty",
		js: `
			const d = document.createElement("div");
			d.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
			assertEqual(d.innerHTML, "<svg></svg>", "empty svg: " + d.innerHTML);
		`,
	}),
	basicTest({
		name: "rv0-ser-empty-attr",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<img src="">';
			assertEqual(d.innerHTML, '<img src="">', "empty src attr: " + d.innerHTML);
		`,
	}),
	basicTest({
		name: "rv0-ser-svg-image-innerhtml-roundtrip",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<svg><image href="https://example.test/a.png" width="10" height="10"></image></svg>';
			const tag = d.querySelector("svg").firstChild.tagName;
			assertEqual(tag, "image", "parsed tag name");
			const again = document.createElement("div");
			again.innerHTML = d.innerHTML;
			assertEqual(again.querySelector("svg").firstChild.namespaceURI, "http://www.w3.org/2000/svg", "round trip stays svg");
			assertEqual(again.querySelector("svg").firstChild.localName, "image", "round trip keeps image");
		`,
	}),
];

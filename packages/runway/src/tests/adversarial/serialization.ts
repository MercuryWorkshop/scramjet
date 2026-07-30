import { basicTest } from "../../testcommon.ts";

// innerHTML/outerHTML un-rewrite URLs and hide the internal bookkeeping
// attribute. Every other way of turning a node back into a string has to do the
// same - XMLSerializer especially, which is how charting libraries export SVG,
// how XML-based APIs build payloads, and how several sanitizers round-trip
// markup.

export default [
	basicTest({
		name: "serialization-domparser",
		js: `
			const doc = new DOMParser().parseFromString(
				'<html><body><a href="/x">y</a><img src="/i.png"></body></html>', "text/html");
			assertEqual(doc.querySelector("a").getAttribute("href"), "/x", "parsed attribute");
			assertEqual(doc.body.innerHTML, '<a href="/x">y</a><img src="/i.png">', "innerHTML round trip");
			assertEqual(doc.querySelector("a").href, location.origin + "/x", "resolved property");
			assert(!doc.body.innerHTML.includes("scramjet-attr"), "no internal attribute in innerHTML");
		`,
	}),
	basicTest({
		name: "serialization-template",
		js: `
			const tpl = document.createElement("template");
			tpl.innerHTML = '<img src="/t.png"><a href="/l">y</a>';
			const img = tpl.content.querySelector("img");
			assertEqual(img.getAttribute("src"), "/t.png", "template attribute");
			assert(!img.src.includes("/~/sj/"), "template img.src must not expose the proxy URL: " + img.src);
			assertEqual(tpl.innerHTML, '<img src="/t.png"><a href="/l">y</a>', "template innerHTML round trip");
			const clone = document.importNode(tpl.content, true);
			assertEqual(clone.querySelector("img").getAttribute("src"), "/t.png", "importNode keeps the attribute");
			document.body.appendChild(clone);
			assertEqual(document.body.querySelector("img").src, location.origin + "/t.png",
				"once adopted, the property resolves against the real origin");
		`,
	}),
	basicTest({
		name: "serialization-outerhtml-paths",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<a href="/x"><img src="/i.png"></a>';
			assertEqual(d.outerHTML, '<div><a href="/x"><img src="/i.png"></a></div>', "outerHTML");
			assertEqual(d.innerHTML, '<a href="/x"><img src="/i.png"></a>', "innerHTML");
			assert(!d.outerHTML.includes("scramjet-attr"), "no internal attribute");
			const wrapper = document.createElement("section");
			wrapper.appendChild(d);
			assertEqual(wrapper.innerHTML, '<div><a href="/x"><img src="/i.png"></a></div>', "nested serialization");
			assertEqual(document.createElement("div").appendChild(d.cloneNode(true)).outerHTML,
				'<div><a href="/x"><img src="/i.png"></a></div>', "cloned serialization");
		`,
	}),
	basicTest({
		name: "serialization-range",
		js: `
			const d = document.createElement("div");
			d.textContent = "hello world";
			document.body.appendChild(d);
			const range = document.createRange();
			range.setStart(d.firstChild, 0);
			range.setEnd(d.firstChild, 5);
			assertEqual(range.toString(), "hello", "range text");
			assertEqual(range.cloneContents().textContent, "hello", "cloneContents");
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
			assertEqual(sel.toString(), "hello", "selection text");
			sel.removeAllRanges();
		`,
	}),
	basicTest({
		name: "serialization-range-createcontextualfragment",
		js: `
			const d = document.createElement("div");
			document.body.appendChild(d);
			const range = document.createRange();
			range.selectNodeContents(d);
			const frag = range.createContextualFragment('<img src="/cf.png">');
			assertEqual(frag.querySelector("img").getAttribute("src"), "/cf.png", "fragment attribute");
			d.appendChild(frag);
			assertEqual(d.querySelector("img").src, location.origin + "/cf.png", "resolved once inserted");
			assertEqual(d.innerHTML, '<img src="/cf.png">', "serialization round trip");
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: serializeToString bypasses the un-rewriting that
		// innerHTML/outerHTML do, exposing both the proxy URL and the internal
		// scramjet-attr-* bookkeeping attribute.
		name: "serialization-xmlserializer-live",
		js: `
			const a = document.createElement("a");
			a.href = "/x";
			const s = new XMLSerializer().serializeToString(a);
			assert(!s.includes("/~/sj/"), "serializeToString must not expose the proxy URL: " + s);
			assert(!s.includes("scramjet-attr"), "nor the internal attribute: " + s);
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same for parsed documents and for SVG, which is the case
		// that matters most - exporting a chart with
		// serializeToString(svgElement) is the standard recipe.
		name: "serialization-xmlserializer-parsed-and-svg",
		js: `
			const doc = new DOMParser().parseFromString('<html><body><a href="/x">y</a></body></html>', "text/html");
			const s = new XMLSerializer().serializeToString(doc.querySelector("a"));
			assert(!s.includes("/~/sj/"), "parsed markup: " + s);
			assert(!s.includes("scramjet-attr"), "parsed markup internal attribute: " + s);
			const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
			image.setAttribute("href", "/s.png");
			const svg = new XMLSerializer().serializeToString(image);
			assert(!svg.includes("/~/sj/"), "svg: " + svg);
			assert(!svg.includes("scramjet-attr"), "svg internal attribute: " + svg);
		`,
	}),
];

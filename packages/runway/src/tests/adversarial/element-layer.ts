import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Regressions found reviewing the element / attribute layer rewrite (#112),
// each one a case the layer got wrong that develop had right, or a hole both
// had. Two kinds of test:
//
//   - escapes, which run PAYLOAD somewhere it should only ever arrive
//     rewritten. Rewritten, `checkglobal(top)` sees the wrapped top and
//     `pass()` runs; unrewritten, it sees the real one and fails
//   - fidelity, where the page reads back something other than what it wrote
//     (or what a browser would have answered)

const PAYLOAD = "checkglobal(top);pass()";
const SAFE_COMPLETION = 'setTimeout(() => pass("no escape"), 100);';
const URL_A = `"https://example.test/a.png"`;

function escapeTest(name: string, js: string) {
	return basicTest({ name, js, autoPass: false, scramjetOnly: true });
}

export default [
	// --- a script's text ----------------------------------------------------

	// Blink defines textContent and innerText again on HTMLScriptElement
	// (they are Trusted Types sinks there), shadowing the Node and HTMLElement
	// interceptors
	escapeTest(
		"elementlayer-script-textcontent",
		`
			const script = document.createElement("script");
			script.textContent = "${PAYLOAD}";
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-sethtmlunsafe",
		`
			const script = document.createElement("script");
			script.setHTMLUnsafe("${PAYLOAD}");
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-insertadjacenthtml",
		`
			const script = document.createElement("script");
			script.insertAdjacentHTML("beforeend", "${PAYLOAD}");
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-child-outerhtml",
		`
			const script = document.createElement("script");
			const span = document.createElement("span");
			script.appendChild(span);
			span.outerHTML = "${PAYLOAD}";
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-range-insertnode-split",
		`
			const script = document.createElement("script");
			script.append("");
			const range = document.createRange();
			range.setStart(script.firstChild, 0);
			range.insertNode(document.createTextNode("${PAYLOAD}"));
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-range-insertnode-element",
		`
			const script = document.createElement("script");
			const range = document.createRange();
			range.selectNodeContents(script);
			range.insertNode(document.createTextNode("${PAYLOAD}"));
			document.body.append(script);
		`
	),
	escapeTest(
		"elementlayer-script-range-surroundcontents",
		`
			const div = document.createElement("div");
			div.textContent = "${PAYLOAD}";
			document.body.append(div);
			const range = document.createRange();
			range.selectNodeContents(div);
			range.surroundContents(document.createElement("script"));
		`
	),
	escapeTest(
		"elementlayer-script-movebefore",
		`
			if (!("moveBefore" in Element.prototype)) {
				pass("no moveBefore");
			} else {
				// connected and empty: prepared, but not started. a move is not
				// an insertion, so natively it does not prepare the script - the
				// next insertion does, and runs the moved text with it
				const script = document.createElement("script");
				document.body.append(script);
				const div = document.createElement("div");
				div.textContent = "${PAYLOAD}";
				document.body.append(div);
				script.moveBefore(div.firstChild, null);
				script.appendChild(document.createTextNode(""));
			}
		`
	),
	// a page-defined Symbol.hasInstance used to decide whether inserted text
	// was blanked before it reached the script
	escapeTest(
		"elementlayer-script-hasinstance-spoof",
		`
			Object.defineProperty(Node, Symbol.hasInstance, { value: () => false });
			const script = document.createElement("script");
			script.appendChild(document.createTextNode("${PAYLOAD}"));
			document.body.append(script);
		`
	),
	// and the tokenizer context markup is rewritten in: <style> is raw text in
	// HTML and a container in SVG
	escapeTest(
		"elementlayer-svg-context-hasinstance-spoof",
		`
			Object.defineProperty(SVGElement, Symbol.hasInstance, { value: () => false });
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			document.body.append(svg);
			svg.innerHTML = '<style><img src="x:" onerror="checkglobal(top)"></style>';
			${SAFE_COMPLETION}
		`
	),
	escapeTest(
		"elementlayer-svg-script-href-baseval",
		`
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const s = document.createElementNS("http://www.w3.org/2000/svg", "script");
			s.href.baseVal = "data:text/javascript,${PAYLOAD}";
			svg.append(s);
			document.body.append(svg);
		`
	),
	escapeTest(
		"elementlayer-svg-script-xlink-any-prefix",
		`
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const s = document.createElementNS("http://www.w3.org/2000/svg", "script");
			s.setAttributeNS("http://www.w3.org/1999/xlink", "x:href", "data:text/javascript,${PAYLOAD}");
			svg.append(s);
			document.body.append(svg);
		`
	),

	basicTest({
		name: "elementlayer-parsed-script-append-text",
		js: `
			const d = document.createElement("div");
			d.innerHTML = "<script>var a = location.href;<\\/script>";
			const s = d.firstChild;
			assertEqual(s.text, "var a = location.href;", "before append");
			s.append("//x");
			assertEqual(s.text, "var a = location.href;//x", "text after append");
			assertEqual(s.textContent, "var a = location.href;//x", "textContent after append");
			// and the node moved out is plain text again
			const out = document.createElement("div");
			out.appendChild(s.firstChild);
			assertEqual(out.textContent, "var a = location.href;", "text moved out of the script");
		`,
	}),
	basicTest({
		name: "elementlayer-script-current-source-while-running",
		js: `
			const source = "window.__elCurrent = document.currentScript.text;";
			const script = document.createElement("script");
			script.text = source;
			document.body.append(script);
			assertEqual(window.__elCurrent, source, "currentScript.text inside the script");
		`,
	}),
	basicTest({
		name: "elementlayer-failed-insert-keeps-text",
		js: `
			const div = document.createElement("div");
			const t = document.createTextNode("hello");
			div.append(t);
			const script = document.createElement("script");
			let threw = null;
			try {
				script.insertBefore(t, document.createElement("p"));
			} catch (e) {
				threw = e.name;
			}
			assertEqual(threw, "NotFoundError", "insertBefore a non-child");
			assertEqual(t.data, "hello", "the node's data");
			assertEqual(div.textContent, "hello", "its parent's text");
		`,
	}),
	basicTest({
		name: "elementlayer-normalize-ancestor-of-script",
		js: `
			const div = document.createElement("div");
			const script = document.createElement("script");
			div.append(script);
			script.append("a = 1;");
			script.append("b = 2;");
			div.normalize();
			assertEqual(script.text, "a = 1;b = 2;", "script text after an ancestor's normalize");
		`,
	}),
	basicTest({
		name: "elementlayer-script-insertadjacenttext-bad-position",
		js: `
			const script = document.createElement("script");
			let threw = null;
			try {
				script.insertAdjacentText("nowhere", "x");
			} catch (e) {
				threw = e.name;
			}
			assertEqual(threw, "SyntaxError", "an invalid position");
			assertEqual(script.text, "", "nothing inserted");
		`,
	}),

	// --- attributes -------------------------------------------------------

	basicTest({
		name: "elementlayer-setattributenode-own-attr",
		js: `
			const img = document.createElement("img");
			img.setAttribute("src", ${URL_A});
			const attr = img.getAttributeNode("src");
			assert(img.setAttributeNode(attr) === attr, "returns the node itself");
			assertEqual(img.getAttribute("src"), ${URL_A}, "getAttribute");
			assertEqual(img.src, ${URL_A}, "img.src");
		`,
	}),
	basicTest({
		name: "elementlayer-setattributenode-in-use",
		js: `
			const a = document.createElement("img");
			const b = document.createElement("img");
			a.setAttribute("src", ${URL_A});
			let threw = null;
			try {
				b.setAttributeNode(a.getAttributeNode("src"));
			} catch (e) {
				threw = e.name;
			}
			assertEqual(threw, "InUseAttributeError", "an attribute owned elsewhere");
			assertEqual(a.getAttribute("src"), ${URL_A}, "its owner's attribute");
			assertEqual(a.src, ${URL_A}, "its owner's src");
		`,
	}),
	basicTest({
		name: "elementlayer-removeattributens-stripped-attribute",
		js: `
			const d = document.createElement("div");
			d.setAttribute("nonce", "abc");
			assert(d.hasAttribute("nonce"), "visible after setAttribute");
			d.removeAttributeNS(null, "nonce");
			assert(!d.hasAttribute("nonce"), "gone after removeAttributeNS");
			d.setAttribute("nonce", "abc");
			d.attributes.removeNamedItemNS(null, "nonce");
			assert(!d.hasAttribute("nonce"), "gone after removeNamedItemNS");
		`,
	}),
	basicTest({
		name: "elementlayer-nonce-slot",
		js: `
			const s = document.createElement("script");
			s.nonce = "idl";
			assertEqual(s.getAttribute("nonce"), null, "the IDL write leaves the content attribute alone");
			assertEqual(s.nonce, "idl", "the IDL read");
			s.setAttribute("nonce", "content");
			assertEqual(s.nonce, "content", "a content write reaches the slot");
			s.removeAttribute("nonce");
			assertEqual(s.nonce, "", "and so does a removal");
		`,
	}),
	basicTest({
		name: "elementlayer-style-mirror-follows-cssom",
		js: `
			const d = document.createElement("div");
			d.setAttribute("style", "color: red;");
			d.style.color = "blue";
			assert(d.getAttribute("style").includes("blue"), "after a named property: " + d.getAttribute("style"));
			d.style.setProperty("background-image", "url(https://example.test/b.png)");
			const value = d.getAttribute("style");
			assert(value.includes("https://example.test/b.png"), "after setProperty, unproxied: " + value);
			const fresh = document.createElement("div");
			fresh.style.backgroundImage = "url(https://example.test/c.png)";
			const created = fresh.getAttribute("style");
			assert(created.includes("https://example.test/c.png"), "a style attribute CSSOM created: " + created);
		`,
	}),
	basicTest({
		name: "elementlayer-iframe-sandbox-tokenlist",
		js: `
			const f = document.createElement("iframe");
			f.setAttribute("sandbox", "allow-scripts");
			assert(f.sandbox.contains("allow-scripts"), "the list sees the page's value");
			assertEqual(f.sandbox.length, 1, "its length");
			f.sandbox.add("allow-forms");
			assertEqual(f.getAttribute("sandbox"), "allow-scripts allow-forms", "after add");
			f.sandbox = "allow-popups";
			assertEqual(f.getAttribute("sandbox"), "allow-popups", "after the PutForwards setter");
			f.setAttribute("sandbox", "allow-modals");
			assert(f.sandbox.contains("allow-modals"), "the list follows setAttribute");
			assert(f.sandbox === f.sandbox, "[SameObject]");
		`,
	}),
	basicTest({
		name: "elementlayer-attributes-method-identity",
		js: `
			const d = document.createElement("div");
			d.setAttribute("id", "x");
			assert(d.attributes.getNamedItem === NamedNodeMap.prototype.getNamedItem, "method identity");
			assertEqual(NamedNodeMap.prototype.item.call(d.attributes, 0).name, "id", "a borrowed method on the wrapper");
		`,
	}),
	basicTest({
		name: "elementlayer-meta-refresh-content",
		js: `
			const m = document.createElement("meta");
			m.content = "5;url=https://example.test/next";
			m.httpEquiv = "refresh";
			assertEqual(m.content, "5;url=https://example.test/next", "content, set before http-equiv");
			assertEqual(m.getAttribute("content"), "5;url=https://example.test/next", "the attribute");
			assert(m.outerHTML.includes("https://example.test/next"), "serialized: " + m.outerHTML);
		`,
	}),

	// --- URLs ---------------------------------------------------------------

	basicTest({
		name: "elementlayer-relative-base-href",
		js: `
			const base = document.createElement("base");
			base.setAttribute("href", "static/");
			document.head.append(base);
			try {
				const img = document.createElement("img");
				img.setAttribute("src", "x.png");
				assertEqual(img.src, location.origin + "/static/x.png", "img.src");
				assertEqual(document.baseURI, location.origin + "/static/", "document.baseURI");
				const a = document.createElement("a");
				a.setAttribute("href", "y");
				assertEqual(a.hostname, location.hostname, "a.hostname");
				assertEqual(base.href, location.origin + "/static/", "base.href");
			} finally {
				base.remove();
			}
		`,
	}),
	// what Blink answers, fragment included - not the proxy's URL
	basicTest({
		name: "elementlayer-base-href-no-attribute",
		js: `
			assertEqual(document.createElement("base").href, location.href, "base.href with no attribute");
		`,
	}),
	// the other half of the script tests above: text inserted into a script
	// that is already connected and empty has to run, rewritten, at insertion
	escapeTest(
		"elementlayer-script-append-after-connect",
		`
			const script = document.createElement("script");
			document.body.append(script);
			script.append(document.createTextNode("${PAYLOAD}"));
		`
	),
];

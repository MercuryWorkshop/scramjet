import { basicTest, serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// Reproductions for findings in the review of #112. These exercise
// the public DOM surface, so the same assertions run in the bare harness.

const moduleTest = (name: string, js: string, files: Record<string, string>) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				const source = files[path];
				if (source === undefined) return;
				res.writeHead(200, { "Content-Type": "application/javascript" });
				res.end(source);
			});
		},
	});

export default [
	basicTest({
		name: "elementlayer-review112-empty-namespace-nonce-change",
		js: `
			const script = document.createElement("script");
			script.nonce = "old-slot";
			script.setAttributeNS("", "nonce", "new-content");
			assertEqual(script.nonce, "new-content", "empty namespace is the null namespace for nonce change steps");
			assertEqual(script.getAttributeNS(null, "nonce"), "new-content", "content attribute remains visible");
			script.removeAttributeNS("", "nonce");
			assertEqual(script.nonce, "", "empty-namespace removal clears the slot");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-detached-attr-after-removal",
		js: `
			const img = document.createElement("img");
			const url = "https://example.test/old.png";
			img.setAttribute("src", url);
			const attr = img.getAttributeNode("src");
			assertEqual(img.removeAttributeNode(attr), attr, "returned attribute identity");
			assertEqual(attr.ownerElement, null, "the attribute is detached");
			assertEqual(attr.value, url, "detached attribute retains the page value");
			assertEqual(attr.nodeValue, url, "detached nodeValue retains the page value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-detached-attr-after-replacement",
		js: `
			const img = document.createElement("img");
			const oldUrl = "https://example.test/old.png";
			const newUrl = "https://example.test/new.png";
			img.setAttribute("src", oldUrl);
			const replacement = document.createAttribute("src");
			replacement.value = newUrl;
			const old = img.setAttributeNode(replacement);
			assertEqual(old.value, oldUrl, "replaced Attr retains the page value");
			assertEqual(replacement.value, newUrl, "inserted Attr exposes the page value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-detached-attr-from-namednodemap",
		js: `
			const img = document.createElement("img");
			const url = "https://example.test/old.png";
			img.setAttribute("src", url);
			const removed = img.attributes.removeNamedItem("src");
			assertEqual(removed.value, url, "NamedNodeMap removal retains the page value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-null-namespace-does-not-find-xlink",
		js: `
			const xlink = "http://www.w3.org/1999/xlink";
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			use.setAttributeNS(xlink, "xlink:href", "https://example.test/icon.svg#shape");
			assertEqual(use.getAttributeNS(null, "xlink:href"), null, "getAttributeNS requires the namespace");
			assertEqual(use.hasAttributeNS(null, "xlink:href"), false, "hasAttributeNS requires the namespace");
			assertEqual(use.getAttributeNodeNS(null, "xlink:href"), null, "getAttributeNodeNS requires the namespace");
			assertEqual(use.attributes.getNamedItemNS(null, "xlink:href"), null, "getNamedItemNS requires the namespace");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-xlink-prefix-change-mirror",
		js: `
			const xlink = "http://www.w3.org/1999/xlink";
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			const first = "https://example.test/first.svg#shape";
			const second = "https://example.test/second.svg#shape";
			use.setAttributeNS(xlink, "x:href", first);
			use.setAttributeNS(xlink, "y:href", second);
			assertEqual(use.getAttributeNS(xlink, "href"), second, "updated namespaced value");
			assertEqual(use.getAttribute("x:href"), second, "existing qualified name reflects the update");
			assertEqual(use.getAttribute("y:href"), null, "no phantom attribute under the new prefix");
			assertEqual(use.getAttributeNames().filter((name) => name === "y:href").length, 0, "no phantom name");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-numeric-attribute-map-keys",
		js: `
			const div = document.createElement("div");
			div.setAttribute("0", "zero");
			const keys = Reflect.ownKeys(div.attributes);
			assert(keys.includes("0"), "numeric attribute is present in own keys");
			assertEqual(div.attributes[0].name, "0", "indexed property remains available");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-selector-list-with-internal-branch",
		js: `
			const host = document.createElement("section");
			const div = document.createElement("div");
			host.append(div);
			assertEqual(host.querySelector("div, [scramjet-attr-src]"), div, "ordinary selector branch still matches");
			assertEqual(host.querySelectorAll("div, [scramjet-attr-src]").length, 1, "selector list retains ordinary matches");
			assertEqual(div.matches("div, [scramjet-attr-src]"), true, "matches accepts either branch");
			assertEqual(div.matches(":not([scramjet-attr-src])"), true, "a hidden attribute is absent for negation");
			assertEqual(div.closest("div, [scramjet-attr-src]"), div, "closest accepts either branch");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-wholetext-stops-at-comment",
		js: `
			const script = document.createElement("script");
			const first = document.createTextNode("left");
			const second = document.createTextNode("right");
			script.append(first, document.createComment("separator"), second);
			assertEqual(first.wholeText, "left", "first run of contiguous Text nodes");
			assertEqual(second.wholeText, "right", "second run of contiguous Text nodes");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-rawtext-innerhtml-serializes-children",
		js: `
			const script = document.createElement("script");
			script.appendChild(document.createComment("marker"));
			assertEqual(script.innerHTML, "<!--marker-->", "script innerHTML serializes comment children");
			if (typeof script.getHTML === "function") {
				assertEqual(script.getHTML(), "<!--marker-->", "script getHTML serializes comment children");
			}
		`,
	}),
	basicTest({
		name: "elementlayer-review112-attr-callback-sees-page-value",
		js: `
			const observed = [];
			class Review112StyleElement extends HTMLElement {
				static observedAttributes = ["style"];
				attributeChangedCallback() {
					observed.push(this.getAttribute("style"));
				}
			}
			customElements.define("review112-style", Review112StyleElement);
			const element = document.createElement("review112-style");
			const value = "background-image: url(https://example.test/image.png)";
			const attr = document.createAttribute("style");
			attr.value = value;
			element.setAttributeNode(attr);
			assertEqual(observed.length, 1, "one callback for the style attribute");
			assertEqual(observed[0], value, "callback sees the page's value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-prefixed-xlink-attr-value",
		js: `
			const xlink = "http://www.w3.org/1999/xlink";
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			const first = "https://example.test/first.svg#shape";
			const second = "https://example.test/second.svg#shape";
			use.setAttributeNS(xlink, "p:href", first);
			const attr = use.getAttributeNodeNS(xlink, "href");
			attr.value = second;
			assertEqual(attr.value, second, "Attr.value reflects the new page URL");
			assertEqual(use.getAttributeNS(xlink, "href"), second, "the XLink attribute is updated");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-namespace-mirror-collision",
		js: `
			const img = document.createElement("img");
			const first = "https://example.test/image.png";
			const second = "https://example.test/other.png";
			img.setAttribute("src", first);
			img.setAttributeNS("urn:review112", "src", second);
			assertEqual(img.getAttribute("src"), first, "the null-namespace src keeps its own value");
			assertEqual(img.getAttributeNS(null, "src"), first, "null-namespace lookup keeps its own value");
			assertEqual(img.getAttributeNS("urn:review112", "src"), second, "the unrelated namespaced attribute keeps its value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-namespaced-callback-sees-page-value",
		js: `
			const observed = [];
			class Review112NamespacedStyleElement extends HTMLElement {
				static observedAttributes = ["style"];
				attributeChangedCallback() {
					observed.push(this.getAttribute("style"));
				}
			}
			customElements.define("review112-ns-style", Review112NamespacedStyleElement);
			const element = document.createElement("review112-ns-style");
			const value = "background-image: url(https://example.test/image.png)";
			element.setAttributeNS(null, "style", value);
			assertEqual(observed.length, 1, "the style change fires one callback");
			assertEqual(observed[0], value, "the synchronous callback sees the page's CSS");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-attribute-map-duplicate-qualified-names",
		js: `
			const element = document.createElement("div");
			element.setAttributeNS("urn:first", "p:x", "one");
			element.setAttributeNS("urn:second", "p:x", "two");
			assertEqual(element.attributes.length, 2, "both namespace-distinct attributes are listed");
			assertEqual(element.attributes.item(0).namespaceURI, "urn:first", "first indexed attribute");
			assertEqual(element.attributes.item(1).namespaceURI, "urn:second", "second indexed attribute");
			assert(element.attributes[0] !== element.attributes[1], "indexed properties identify distinct Attr nodes");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-setattributenode-replaces-other-prefix",
		js: `
			const xlink = "http://www.w3.org/1999/xlink";
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			const first = "https://example.test/first.svg#shape";
			const second = "https://example.test/second.svg#shape";
			use.setAttributeNS(xlink, "xlink:href", first);
			const old = use.getAttributeNodeNS(xlink, "href");
			const replacement = document.createAttributeNS(xlink, "p:href");
			replacement.value = second;
			assertEqual(use.setAttributeNode(replacement), old, "the matching namespace and local name are replaced");
			assertEqual(old.ownerElement, null, "the old Attr is detached");
			assertEqual(old.value, first, "the detached Attr retains its page value");
			assertEqual(use.getAttributeNS(xlink, "href"), second, "the replacement exposes its page value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-cloned-script-text-source",
		js: `
			const script = document.createElement("script");
			const source = "var __review112 = location.href.length + 1;";
			script.textContent = source;
			const clone = script.firstChild.cloneNode();
			assertEqual(clone.data, source, "a cloned Text node exposes the page's source");
			assertEqual(clone.textContent, source, "cloned textContent exposes the page's source");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-fragment-moved-script-text-source",
		js: `
			const script = document.createElement("script");
			const source = "var __review112 = location.href.length + 1;";
			script.textContent = source;
			const text = script.firstChild;
			const fragment = document.createDocumentFragment();
			fragment.append(text);
			assertEqual(text.data, source, "the moved Text node keeps the page source");
			assertEqual(fragment.textContent, source, "the fragment exposes the page source");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-range-script-text-source",
		js: `
			const script = document.createElement("script");
			const source = "var __review112_range = location.href.length + 1;";
			script.textContent = source;
			const range = document.createRange();
			range.selectNodeContents(script);
			assertEqual(range.toString(), source, "Range stringification exposes the page's source");
			assertEqual(range.cloneContents().textContent, source, "cloned range content exposes the page's source");
			assertEqual(range.extractContents().textContent, source, "extracted range content exposes the page's source");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-scoped-import-map",
		js: `
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({
				scopes: { [location.origin + "/"]: { "review112-scoped": "data:text/javascript,export default 112" } }
			});
			document.head.append(map);
			const module = await import("review112-scoped");
			assertEqual(module.default, 112, "a scoped import map resolves from the document's origin");
		`,
	}),
	serverTest({
		name: "elementlayer-review112-import-map-integrity",
		autoPass: true,
		js: `
			const checked = location.origin + "/review112-integrity.js?checked";
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({
				integrity: { [checked]: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }
			});
			document.head.append(map);
			const control = await import("/review112-integrity.js?control");
			assertEqual(control.default, 112, "the module loads without integrity metadata");
			let rejected = false;
			try { await import("/review112-integrity.js?checked"); }
			catch { rejected = true; }
			assertEqual(rejected, true, "import map integrity rejects a module with the wrong digest");
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url?.startsWith("/review112-integrity.js?")) {
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end("export default 112;");
				}
			});
		},
	}),
	basicTest({
		name: "elementlayer-review112-script-source-marker-alias",
		js: `
			const script = document.createElement("script");
			script.textContent = "var __review112_marker = location.href;";
			assertEqual(script.getAttribute("script-source-src"), null, "internal source marker is not a public attribute");
			assertEqual(script.hasAttribute("script-source-src"), false, "internal source marker is absent from hasAttribute");
			assertEqual(script.getAttributeNode("script-source-src"), null, "internal source marker has no public Attr node");
			script.setAttribute("script-source-src", "page-value");
			assertEqual(script.getAttribute("script-source-src"), "page-value", "a page attribute of the same name keeps its value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-stripped-attr-value-change-steps",
		js: `
			const script = document.createElement("script");
			script.setAttribute("nonce", "old");
			script.getAttributeNode("nonce").value = "new";
			assertEqual(script.nonce, "new", "Attr.value runs the nonce change steps");
			const frame = document.createElement("iframe");
			frame.setAttribute("sandbox", "allow-scripts");
			const tokens = frame.sandbox;
			frame.getAttributeNode("sandbox").value = "allow-forms";
			assertEqual(tokens.contains("allow-forms"), true, "an existing sandbox token list sees the new value");
			assertEqual(tokens.contains("allow-scripts"), false, "an existing sandbox token list drops the old value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-svg-href-arbitrary-xlink-prefix",
		js: `
			const xlink = "http://www.w3.org/1999/xlink";
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			const first = "https://example.test/first.svg#shape";
			const second = "https://example.test/second.svg#shape";
			use.setAttributeNS(xlink, "p:href", first);
			assertEqual(use.href.baseVal, first, "baseVal exposes the page's XLink URL");
			assertEqual(use.href.animVal, first, "animVal exposes the page's XLink URL");
			use.href.baseVal = second;
			assertEqual(use.getAttributeNS(xlink, "href"), second, "baseVal updates the existing XLink attribute");
			assertEqual(use.getAttribute("href"), null, "baseVal does not create another href attribute");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-rawtext-nested-textcontent",
		js: `
			for (const tag of ["script", "style"]) {
				const element = document.createElement(tag);
				const child = document.createElement("b");
				child.textContent = "nested text";
				element.append(child);
				assertEqual(element.textContent, "nested text", tag + " textContent includes descendant text");
			}
		`,
	}),
	basicTest({
		name: "elementlayer-review112-parsed-attribute-order",
		js: `
			const template = document.createElement("template");
			template.innerHTML = '<script nonce="value" id="marker"></script>';
			const script = template.content.firstElementChild;
			assertEqual(script.getAttributeNames().join(","), "nonce,id", "parsed attribute names retain source order");
			assertEqual(script.attributes.item(0).name, "nonce", "NamedNodeMap index zero retains the first attribute");
		`,
	}),
	moduleTest(
		"elementlayer-review112-import-map-prefix-static",
		`
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({ imports: { "review112-prefix/": "/mapped/" } });
			document.head.append(map);
			const entry = await import("/prefix-entry.js");
			assertEqual(entry.default, 112, "a prefix mapping resolves a static import");
		`,
		{
			"/prefix-entry.js":
				'import value from "review112-prefix/item.js"; export default value;',
			"/mapped/item.js": "export default 112;",
		}
	),
	moduleTest(
		"elementlayer-review112-import-map-url-key-static",
		`
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({ imports: { "/original.js": "/mapped.js" } });
			document.head.append(map);
			const entry = await import("/url-key-entry.js");
			assertEqual(entry.default, 112, "a URL-like key remaps a static import");
		`,
		{
			"/url-key-entry.js":
				'import value from "/original.js"; export default value;',
			"/original.js": "export default 111;",
			"/mapped.js": "export default 112;",
		}
	),
	basicTest({
		name: "elementlayer-review112-import-map-ignores-text-mutation",
		js: `
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({
				imports: { "review112-mutated": "data:text/javascript,export default 112" }
			});
			document.head.append(map);
			map.textContent = JSON.stringify({
				imports: { "review112-mutated": "data:text/javascript,export default 113" }
			});
			const module = await import("review112-mutated");
			assertEqual(module.default, 112, "a registered map keeps its original value after text mutation");
		`,
	}),
	moduleTest(
		"elementlayer-review112-import-map-exact-scope-static",
		`
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({
				scopes: { [location.origin + "/scope-entry.js"]: { "review112-exact": "/scope-target.js" } }
			});
			document.head.append(map);
			const entry = await import("/scope-entry.js");
			assertEqual(entry.default, 112, "an exact scope applies to its module's static import");
		`,
		{
			"/scope-entry.js":
				'import value from "review112-exact"; export default value;',
			"/scope-target.js": "export default 112;",
		}
	),
	basicTest({
		name: "elementlayer-review112-range-script-text-offset",
		js: `
			const script = document.createElement("script");
			script.textContent = "location.href";
			const node = script.firstChild;
			const range = document.createRange();
			range.selectNodeContents(node);
			assertEqual(range.endOffset, node.length, "Range endOffset uses the page's Text length");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-invalid-import-map-rejected",
		js: `
			const suppressParseError = (event) => {
				if (String(event.message).includes("Failed to parse import map")) event.preventDefault();
			};
			window.addEventListener("error", suppressParseError);
			const map = document.createElement("script");
			map.type = "importmap";
			map.textContent = JSON.stringify({
				imports: [],
				scopes: { [location.origin + "/"]: { "review112-invalid": "data:text/javascript,export default 112" } }
			});
			document.head.append(map);
			let rejected = false;
			try { await import("review112-invalid"); }
			catch { rejected = true; }
			window.removeEventListener("error", suppressParseError);
			assertEqual(rejected, true, "an invalid imports field rejects the entire map");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-selector-rewritten-attribute-value",
		js: `
			const img = document.createElement("img");
			img.setAttribute("src", "/review112-image.png");
			assertEqual(img.getAttribute("src"), "/review112-image.png", "the page sees the original src");
			assertEqual(img.matches('[src="/review112-image.png"]'), true, "attribute selectors match the page's value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-selector-stripped-attribute",
		js: `
			const iframe = document.createElement("iframe");
			iframe.setAttribute("sandbox", "allow-scripts");
			assertEqual(iframe.hasAttribute("sandbox"), true, "the sandbox attribute is visible");
			assertEqual(iframe.matches("[sandbox]"), true, "attribute selectors find a stripped attribute");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-mutation-observer-attribute-records",
		js: `
			const img = document.createElement("img");
			const observer = new MutationObserver(() => {});
			observer.observe(img, { attributes: true, attributeOldValue: true });
			img.setAttribute("src", "/review112-image.png");
			const records = observer.takeRecords();
			observer.disconnect();
			assertEqual(records.map((record) => record.attributeName).join(","), "src", "one page-visible attribute mutation is recorded");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-stripped-attribute-custom-element-reaction",
		js: `
			const observed = [];
			class Review112NonceReaction extends HTMLElement {
				static observedAttributes = ["nonce"];
				attributeChangedCallback(name, oldValue, newValue) {
					observed.push([name, oldValue, newValue]);
				}
			}
			customElements.define("review112-nonce-reaction", Review112NonceReaction);
			const element = document.createElement("review112-nonce-reaction");
			element.setAttribute("nonce", "value");
			assertEqual(observed.length, 1, "the nonce mutation invokes the observed callback");
			assertEqual(observed[0].join(","), "nonce,,value", "the callback receives the visible name and value");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-stripped-setattributenode-identity",
		js: `
			const element = document.createElement("div");
			const attr = document.createAttribute("nonce");
			attr.value = "value";
			element.setAttributeNode(attr);
			assertEqual(attr.ownerElement, element, "the supplied Attr remains attached");
			assertEqual(element.getAttributeNode("nonce"), attr, "getAttributeNode returns the supplied Attr");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-normalize-separated-script-text",
		js: `
			const script = document.createElement("script");
			const first = document.createTextNode("location");
			const separator = document.createComment("separator");
			const second = document.createTextNode(".href");
			script.append(first, separator, second);
			script.normalize();
			assertEqual(script.childNodes.length, 3, "normalize retains noncontiguous nonempty Text nodes");
			assertEqual(script.childNodes[2], second, "the second Text node retains its position");
			assertEqual(second.parentNode, script, "the second Text node remains attached");
		`,
	}),
	basicTest({
		name: "elementlayer-review112-ancestor-rawtext-nested-textcontent",
		js: `
			const parent = document.createElement("div");
			const script = document.createElement("script");
			const nested = document.createElement("b");
			nested.textContent = "nested";
			script.append(nested);
			parent.append(script);
			assertEqual(parent.textContent, "nested", "an ancestor includes text nested inside a script");
		`,
	}),
];

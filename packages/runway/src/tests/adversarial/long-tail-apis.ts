import { basicTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// KNOWN FAILURES in APIs that Scramjet already intercepts but that sit well
// outside the primary DOM/fetch/navigation paths. Keep these as differential
// tests: the bare harness is the browser oracle and each case is issue-sized.
const probe = (name: string, js: string) =>
	basicTest({
		name: `longtail-api-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name, message: error && error.message };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

export default [
	// Navigator protocol-handler methods are explicitly intercepted as no-ops.
	probe(
		"protocol-register-missing-arguments",
		`(() => navigator.registerProtocolHandler())()`
	),
	probe(
		"protocol-register-forbidden-scheme",
		`(() => navigator.registerProtocolHandler("http", location.origin + "/open?url=%s"))()`
	),
	probe(
		"protocol-register-invalid-scheme",
		`(() => navigator.registerProtocolHandler("not a scheme", location.origin + "/open?url=%s"))()`
	),
	probe(
		"protocol-register-missing-placeholder",
		`(() => navigator.registerProtocolHandler("web+runway", location.origin + "/open"))()`
	),
	probe(
		"protocol-register-cross-origin-template",
		`(() => navigator.registerProtocolHandler("web+runway", "https://example.com/open?url=%s"))()`
	),
	probe(
		"protocol-unregister-missing-arguments",
		`(() => navigator.unregisterProtocolHandler())()`
	),
	probe(
		"protocol-unregister-invalid-scheme",
		`(() => navigator.unregisterProtocolHandler("not a scheme", location.origin + "/open?url=%s"))()`
	),

	// PerformanceEntry.name and all entry-list methods are intercepted.
	probe(
		"performance-resource-tojson-name",
		`(() => performance.getEntriesByType("resource").find((e) => e.name.endsWith("/script.js")).toJSON().name)()`
	),
	probe(
		"performance-navigation-tojson-name",
		`(() => performance.getEntriesByType("navigation")[0].toJSON().name)()`
	),
	probe(
		"performance-getentriesbyname-author-url",
		`(() => performance.getEntriesByName(location.origin + "/script.js").length)()`
	),
	probe(
		"performance-user-mark-masked-name",
		`(() => { performance.mark("inject.js"); const count = performance.getEntriesByType("mark").filter((e) => e.name === "inject.js").length; performance.clearMarks("inject.js"); return count; })()`
	),

	// document.domain is a deprecated but still-intercepted Document surface.
	probe(
		"document-domain-invalid-setter",
		`(() => { document.domain = "example.com"; return document.domain; })()`
	),
	probe(
		"document-domain-getter-brand",
		`(() => Object.getOwnPropertyDescriptor(Document.prototype, "domain").get.call({}))()`
	),
	probe(
		"document-domain-setter-brand",
		`(() => Object.getOwnPropertyDescriptor(Document.prototype, "domain").set.call({}, "localhost"))()`
	),

	// CSS Typed OM parse() is intercepted even though the rest of Typed OM is not.
	probe(
		"typed-om-background-image-readback",
		`(() => typeof CSSStyleValue === "undefined" ? "unsupported" : CSSStyleValue.parse("background-image", "url(/a.png)").toString())()`
	),
	probe(
		"typed-om-background-shorthand-readback",
		`(() => typeof CSSStyleValue === "undefined" ? "unsupported" : CSSStyleValue.parse("background", "url(/a.png) center").toString())()`
	),
	probe(
		"typed-om-custom-property-readback",
		`(() => typeof CSSStyleValue === "undefined" ? "unsupported" : CSSStyleValue.parse("--asset", "url(/a.png)").toString())()`
	),

	// getSVGDocument() and embedded contentDocument/contentWindow are intercepted.
	probe(
		"svgdocument-object-blob",
		`(async () => {
			const url = URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>'], {type:"image/svg+xml"}));
			const object = document.createElement("object");
			object.type = "image/svg+xml";
			object.data = url;
			document.body.append(object);
			await new Promise((resolve) => { object.onload = resolve; object.onerror = resolve; });
			const doc = object.getSVGDocument();
			const value = doc && [doc === object.contentDocument, doc.documentElement.localName];
			object.remove();
			URL.revokeObjectURL(url);
			return value;
		})()`
	),
	probe(
		"svgdocument-embed-blob",
		`(async () => {
			const url = URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>'], {type:"image/svg+xml"}));
			const embed = document.createElement("embed");
			embed.type = "image/svg+xml";
			embed.src = url;
			document.body.append(embed);
			await new Promise((resolve) => { embed.onload = resolve; embed.onerror = resolve; });
			const doc = embed.getSVGDocument();
			const value = doc && [doc === embed.contentDocument, doc.documentElement.localName];
			embed.remove();
			URL.revokeObjectURL(url);
			return value;
		})()`
	),
	// The new HTML serialization APIs have dedicated interceptors.
	probe(
		"gethtml-serializable-boolean-attribute",
		`(() => {
			if (!Element.prototype.getHTML) return "unsupported";
			const host = document.createElement("div");
			host.attachShadow({mode:"open", serializable:true}).innerHTML = "<span></span>";
			return host.getHTML({serializableShadowRoots:true});
		})()`
	),
	probe(
		"parsehtmlunsafe-secondary-document-url",
		`(() => {
			if (!Document.parseHTMLUnsafe) return "unsupported";
			const parsed = Document.parseHTMLUnsafe("<p>x</p>");
			return [parsed.URL, parsed.documentURI, parsed.baseURI];
		})()`
	),
];

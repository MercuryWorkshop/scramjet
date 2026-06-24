import { basicTest } from "../../testcommon.ts";

// Coverage for the trusted-types proxy installed by
// packages/core/src/client/shared/trustedtypes.ts. These tests assume the
// `trustedTypes` flag is on (the default). The proxy either passes native TT
// through unchanged (Chromium) or installs a spec-shaped polyfill.

export default [
	basicTest({
		name: "trustedtypes-globals-exist",
		js: `
			assert(typeof window.trustedTypes === "object" && window.trustedTypes !== null,
				"window.trustedTypes must be an object");
			assert(typeof window.TrustedHTML === "function",
				"TrustedHTML constructor must exist");
			assert(typeof window.TrustedScript === "function",
				"TrustedScript constructor must exist");
			assert(typeof window.TrustedScriptURL === "function",
				"TrustedScriptURL constructor must exist");
			assert(typeof window.TrustedTypePolicy === "function",
				"TrustedTypePolicy constructor must exist");
			assert(typeof window.TrustedTypePolicyFactory === "function",
				"TrustedTypePolicyFactory constructor must exist");
		`,
	}),

	basicTest({
		name: "trustedtypes-factory-shape",
		js: `
			const tt = window.trustedTypes;
			assert(typeof tt.createPolicy === "function", "createPolicy must be a function");
			assert(typeof tt.isHTML === "function", "isHTML must be a function");
			assert(typeof tt.isScript === "function", "isScript must be a function");
			assert(typeof tt.isScriptURL === "function", "isScriptURL must be a function");
			assert(typeof tt.getAttributeType === "function", "getAttributeType must be a function");
			assert(typeof tt.getPropertyType === "function", "getPropertyType must be a function");
			assert(tt.emptyHTML !== undefined, "emptyHTML must exist");
			assert(tt.emptyScript !== undefined, "emptyScript must exist");
			// defaultPolicy is a getter; reading it before any policy is created
			// should return null (the harness page itself doesn't make one).
			assert(tt.defaultPolicy === null || tt.defaultPolicy === undefined ||
				typeof tt.defaultPolicy === "object",
				"defaultPolicy must be null or a policy object");
		`,
	}),

	basicTest({
		name: "trustedtypes-constructors-throw",
		js: `
			let threw;
			threw = false;
			try { new window.TrustedHTML(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new TrustedHTML() must throw TypeError");

			threw = false;
			try { new window.TrustedScript(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new TrustedScript() must throw TypeError");

			threw = false;
			try { new window.TrustedScriptURL(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new TrustedScriptURL() must throw TypeError");

			threw = false;
			try { new window.TrustedTypePolicy(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new TrustedTypePolicy() must throw TypeError");

			threw = false;
			try { new window.TrustedTypePolicyFactory(); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new TrustedTypePolicyFactory() must throw TypeError");
		`,
	}),

	basicTest({
		name: "trustedtypes-create-policy-basic",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-basic-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, {
				createHTML: (s) => "[" + s + "]",
				createScript: (s) => "/*" + s + "*/",
				createScriptURL: (s) => s + "#ok",
			});
			assert(pol.name === name, "policy.name should equal name passed to createPolicy, got: " + pol.name);
			assert(typeof pol.createHTML === "function", "policy.createHTML must be a function");
			assert(typeof pol.createScript === "function", "policy.createScript must be a function");
			assert(typeof pol.createScriptURL === "function", "policy.createScriptURL must be a function");

			const h = pol.createHTML("hi");
			const s = pol.createScript("alert(1)");
			const u = pol.createScriptURL("https://example.com/x.js");

			assert(String(h) === "[hi]", "createHTML output should pass through the policy callback, got: " + String(h));
			assert(String(s) === "/*alert(1)*/", "createScript output should pass through, got: " + String(s));
			assert(String(u).indexOf("#ok") !== -1, "createScriptURL output should pass through, got: " + String(u));

			assert(h instanceof window.TrustedHTML, "createHTML result must be TrustedHTML");
			assert(s instanceof window.TrustedScript, "createScript result must be TrustedScript");
			assert(u instanceof window.TrustedScriptURL, "createScriptURL result must be TrustedScriptURL");
		`,
	}),
	// this can actually throw if its enabled in the csp, we dont emulate csp in scramjet
	// https://developer.mozilla.org/en-US/docs/Web/API/TrustedTypePolicyFactory/createPolicy#exceptions
	/* 
	basicTest({
		name: "trustedtypes-policy-duplicate-name-throws",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-dup-" + Math.random().toString(36).slice(2, 10);
			tt.createPolicy(name, { createHTML: (s) => s });
			let threw = false;
			try {
				tt.createPolicy(name, { createHTML: (s) => s });
			} catch (e) {
				threw = e instanceof TypeError;
			}
			assert(threw, "creating policy with duplicate name should throw TypeError");
		`,
	}),
	*/
	basicTest({
		name: "trustedtypes-policy-missing-callback",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-miss-" + Math.random().toString(36).slice(2, 10);
			// Policy with only createHTML implemented
			const pol = tt.createPolicy(name, { createHTML: (s) => s });

			// createHTML works
			const ok = pol.createHTML("x");
			assert(String(ok) === "x", "createHTML should still work, got: " + String(ok));

			// createScript should throw because callback isn't provided
			let threw = false;
			try { pol.createScript("y"); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "policy.createScript without callback must throw TypeError");

			threw = false;
			try { pol.createScriptURL("z"); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "policy.createScriptURL without callback must throw TypeError");
		`,
	}),
	
	basicTest({
		name: "trustedtypes-policy-callback-receives-original-input",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-in-" + Math.random().toString(36).slice(2, 10);
			let captured;
			let capturedExtras;
			const pol = tt.createPolicy(name, {
				createHTML: (input, ...rest) => {
					captured = input;
					capturedExtras = rest;
					return input;
				},
			});
			pol.createHTML("<b>hello</b>", "extra-1", 42);
			assert(captured === "<b>hello</b>",
				"callback should receive original input, got: " + JSON.stringify(captured));
			assert(Array.isArray(capturedExtras) && capturedExtras.length === 2,
				"callback should receive extra args, got: " + JSON.stringify(capturedExtras));
			assert(capturedExtras[0] === "extra-1" && capturedExtras[1] === 42,
				"extra args should be passed through verbatim");
		`,
	}),

	basicTest({
		name: "trustedtypes-policy-coerces-non-string-input",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-coerce-" + Math.random().toString(36).slice(2, 10);
			let captured;
			const pol = tt.createPolicy(name, {
				createHTML: (input) => {
					captured = input;
					return input;
				},
			});
			pol.createHTML({ toString: () => "object-as-html" });
			assert(typeof captured === "string",
				"callback input should be coerced to string, got: " + typeof captured);
			assert(captured === "object-as-html",
				"callback input should reflect toString(), got: " + captured);
		`,
	}),

	basicTest({
		name: "trustedtypes-is-helpers",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-is-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, {
				createHTML: (s) => s,
				createScript: (s) => s,
				createScriptURL: (s) => s,
			});
			const h = pol.createHTML("h");
			const s = pol.createScript("s");
			const u = pol.createScriptURL("https://example.com/");

			assert(tt.isHTML(h) === true, "isHTML(TrustedHTML) must be true");
			assert(tt.isScript(s) === true, "isScript(TrustedScript) must be true");
			assert(tt.isScriptURL(u) === true, "isScriptURL(TrustedScriptURL) must be true");

			assert(tt.isHTML(s) === false, "isHTML(TrustedScript) must be false");
			assert(tt.isScript(u) === false, "isScript(TrustedScriptURL) must be false");
			assert(tt.isScriptURL(h) === false, "isScriptURL(TrustedHTML) must be false");

			assert(tt.isHTML("plain") === false, "isHTML(string) must be false");
			assert(tt.isHTML(null) === false, "isHTML(null) must be false");
			assert(tt.isHTML(undefined) === false, "isHTML(undefined) must be false");
			assert(tt.isHTML({}) === false, "isHTML({}) must be false");
		`,
	}),

	basicTest({
		name: "trustedtypes-empty-singletons",
		js: `
			const tt = window.trustedTypes;
			assert(tt.isHTML(tt.emptyHTML), "emptyHTML should be a TrustedHTML");
			assert(tt.isScript(tt.emptyScript), "emptyScript should be a TrustedScript");
			assert(String(tt.emptyHTML) === "", "emptyHTML.toString() should be empty");
			assert(String(tt.emptyScript) === "", "emptyScript.toString() should be empty");
		`,
	}),

	basicTest({
		name: "trustedtypes-default-policy-tracks",
		js: `
			const tt = window.trustedTypes;
			// A given window only ever has one default policy; this test creates one
			// if absent and asserts the getter reflects it. Since tests share a
			// harness page in some run modes we tolerate either the pre-existing
			// default policy or our newly created one.
			let pol = tt.defaultPolicy;
			if (!pol) {
				pol = tt.createPolicy("default", {
					createHTML: (s) => s,
					createScript: (s) => s,
					createScriptURL: (s) => s,
				});
			}
			assert(tt.defaultPolicy === pol,
				"defaultPolicy getter should return the default policy reference");
			assert(pol.name === "default", "default policy must be named 'default'");
		`,
	}),

	basicTest({
		name: "trustedtypes-get-attribute-type",
		js: `
			const tt = window.trustedTypes;
			assert(tt.getAttributeType("script", "src") === "TrustedScriptURL",
				"script[src] should map to TrustedScriptURL, got: " + tt.getAttributeType("script", "src"));
			assert(tt.getAttributeType("iframe", "srcdoc") === "TrustedHTML",
				"iframe[srcdoc] should map to TrustedHTML, got: " + tt.getAttributeType("iframe", "srcdoc"));
			assert(tt.getAttributeType("div", "id") === null,
				"div[id] should not require a trusted type, got: " + tt.getAttributeType("div", "id"));
			// event handler attributes (on*) require TrustedScript on every element
			assert(tt.getAttributeType("div", "onclick") === "TrustedScript",
				"div[onclick] should map to TrustedScript, got: " + tt.getAttributeType("div", "onclick"));
		`,
	}),

	basicTest({
		name: "trustedtypes-get-property-type",
		js: `
			const tt = window.trustedTypes;
			assert(tt.getPropertyType("div", "innerHTML") === "TrustedHTML",
				"div.innerHTML should map to TrustedHTML, got: " + tt.getPropertyType("div", "innerHTML"));
			assert(tt.getPropertyType("script", "src") === "TrustedScriptURL",
				"script.src should map to TrustedScriptURL, got: " + tt.getPropertyType("script", "src"));
			assert(tt.getPropertyType("script", "text") === "TrustedScript",
				"script.text should map to TrustedScript, got: " + tt.getPropertyType("script", "text"));
			assert(tt.getPropertyType("div", "id") === null,
				"div.id should not require a trusted type");
		`,
	}),

	basicTest({
		name: "trustedtypes-innerhtml-with-trusted",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-ih-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, { createHTML: (s) => s });
			const html = pol.createHTML("<b>hello</b><i>world</i>");
			const div = document.createElement("div");
			div.innerHTML = html;
			assert(div.children.length === 2,
				"innerHTML with TrustedHTML should create 2 children, got: " + div.children.length);
			assert(div.children[0].tagName === "B",
				"first child should be <b>, got: " + div.children[0].tagName);
			assert(div.children[1].tagName === "I",
				"second child should be <i>, got: " + div.children[1].tagName);
			assert(div.textContent === "helloworld",
				"text content should match, got: " + div.textContent);
		`,
	}),

	basicTest({
		name: "trustedtypes-innerhtml-with-string-still-works",
		js: `
			// scramjet strips CSP so a plain string assignment to innerHTML must
			// continue to work regardless of whether a default policy exists.
			const div = document.createElement("div");
			div.innerHTML = "<span>raw</span>";
			assert(div.children.length === 1,
				"innerHTML with raw string should still create a child, got: " + div.children.length);
			assert(div.firstChild.tagName === "SPAN",
				"child should be <span>, got: " + div.firstChild.tagName);
		`,
	}),

	basicTest({
		name: "trustedtypes-script-src-with-trusted",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-sru-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, {
				createScriptURL: (s) => s,
			});
			const url = pol.createScriptURL("data:text/javascript,");
			const script = document.createElement("script");
			script.src = url;
			assert(String(script.src).indexOf("data:") !== -1 ||
				String(script.getAttribute("src")).indexOf("data:") !== -1,
				"script.src assigned a TrustedScriptURL should retain the data: prefix, got: " + script.src);
		`,
	}),

	basicTest({
		name: "trustedtypes-script-text-with-trusted",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-st-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, { createScript: (s) => s });
			const ts = pol.createScript("var x = 1;");
			const script = document.createElement("script");
			script.text = ts;
			// either the textContent passed through or scramjet rewrote it; either
			// way we should see the variable name in the resulting text.
			const out = script.textContent || script.text || "";
			assert(out.indexOf("x") !== -1,
				"script.text should contain the assigned token, got: " + out);
		`,
	}),

	basicTest({
		name: "trustedtypes-iframe-srcdoc-with-trusted",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-sd-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, { createHTML: (s) => s });
			const doc = pol.createHTML("<!doctype html><html><body><p id='hi'>x</p></body></html>");
			const iframe = document.createElement("iframe");
			iframe.srcdoc = doc;
			assert(typeof iframe.srcdoc === "string",
				"iframe.srcdoc should be readable as a string");
			document.body.appendChild(iframe);
			// don't wait for the iframe to load — just confirm the attribute was
			// accepted without throwing
			document.body.removeChild(iframe);
		`,
	}),

	basicTest({
		name: "trustedtypes-iframe-contentwindow-exposes-tt",
		js: `
			const iframe = document.createElement("iframe");
			iframe.style.display = "none";
			iframe.sandbox = "allow-scripts allow-same-origin";
			document.body.appendChild(iframe);
			try {
				const cw = iframe.contentWindow;
				assert(cw !== null, "iframe contentWindow must be present");
				// new about:blank iframes inherit the trusted-types globals from
				// the parent realm; the surface must look symmetric.
				assert(typeof cw.trustedTypes === "object" && cw.trustedTypes !== null,
					"iframe.contentWindow.trustedTypes must be an object");
				assert(typeof cw.TrustedHTML === "function",
					"iframe TrustedHTML constructor must exist");
				assert(typeof cw.trustedTypes.createPolicy === "function",
					"iframe trustedTypes.createPolicy must be a function");
			} finally {
				document.body.removeChild(iframe);
			}
		`,
	}),

	basicTest({
		name: "trustedtypes-toString-and-toJSON",
		js: `
			const tt = window.trustedTypes;
			const name = "scramjet-test-ts-" + Math.random().toString(36).slice(2, 10);
			const pol = tt.createPolicy(name, {
				createHTML: (s) => "[" + s + "]",
			});
			const h = pol.createHTML("yo");
			// implicit String() conversion
			assert("" + h === "[yo]", "string concat should call toString, got: " + ("" + h));
			// toJSON should also surface the inner value
			const json = JSON.stringify({ h });
			assert(json === JSON.stringify({ h: "[yo]" }),
				"JSON.stringify should use toJSON, got: " + json);
		`,
	}),

	basicTest({
		name: "trustedtypes-independent-policies",
		js: `
			const tt = window.trustedTypes;
			const a = "scramjet-test-ind-a-" + Math.random().toString(36).slice(2, 10);
			const b = "scramjet-test-ind-b-" + Math.random().toString(36).slice(2, 10);
			const polA = tt.createPolicy(a, { createHTML: (s) => "A:" + s });
			const polB = tt.createPolicy(b, { createHTML: (s) => "B:" + s });
			assert(polA !== polB, "distinct policies should be distinct objects");
			assert(String(polA.createHTML("x")) === "A:x", "policy A should keep its callback");
			assert(String(polB.createHTML("x")) === "B:x", "policy B should keep its callback");
		`,
	}),
];

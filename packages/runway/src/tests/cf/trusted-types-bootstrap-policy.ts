import { basicTest } from "../../testcommon.ts";

// Ported from data4/inner.js_translated.js:570-614 and
// data4/payload2_lifted.js:13-14, 27052-27217.
//
// Cloudflare installs identity wrappers, attempts a restrictive default policy,
// then creates a named ysPu6 policy whose createHTML/createScript/createScriptURL
// outputs are used by HTML/script/blob URL sinks. Preserve the exact policy names
// and fallback wrapper behavior while comparing Trusted Types object shapes.

export default basicTest({
	name: "cf-trusted-types-bootstrap-policy",
	js: `
		const previous = {
			yZYbk3: window.yZYbk3,
			zjVu3: window.zjVu3,
			cAtV0: window.cAtV0,
		};

		window.yZYbk3 = function(s) { return s; };
		window.zjVu3 = function(s) { return s; };
		window.cAtV0 = function(s) { return s; };

		try {
			const snapshot = {
				hasTrustedTypes: !!window.trustedTypes,
				createPolicyType: window.trustedTypes ? typeof window.trustedTypes.createPolicy : "missing",
				defaultPolicy: null,
				ysPolicy: null,
				outputs: null,
			};

			if (window.trustedTypes && window.trustedTypes.createPolicy) {
				try {
					window.trustedTypes.createPolicy("default", {
						createHTML: function() { return ""; },
						createScript: function(s) {
							if (s === "this" || s === "return this") return s;
							return "";
						},
						createScriptURL: function() { return ""; },
					});
					snapshot.defaultPolicy = { ok: true };
				} catch (e) {
					snapshot.defaultPolicy = { ok: false, name: e.name, message: e.message };
				}

				try {
					const policyName = "ysPu6-runway";
					const p = window.trustedTypes.createPolicy(policyName, {
						createHTML: function(s) { return s; },
						createScript: function(s) { return s; },
						createScriptURL: function(s) { return s; },
					});
					window.yZYbk3 = function(s) { return p.createHTML(s); };
					window.zjVu3 = function(s) { return p.createScript(s); };
					window.cAtV0 = function(s) { return p.createScriptURL(s); };

					const html = window.yZYbk3("<b>cf</b>");
					const scriptAllowed = window.zjVu3("return this");
					const scriptDeniedByNamedPolicy = window.zjVu3("alert(1)");
					const scriptUrl = window.cAtV0("blob:https://example.com/cf");
					snapshot.ysPolicy = { ok: true, name: p.name };
					snapshot.outputs = {
						htmlType: Object.prototype.toString.call(html),
						htmlString: String(html),
						scriptAllowedType: Object.prototype.toString.call(scriptAllowed),
						scriptAllowedString: String(scriptAllowed),
						scriptDeniedType: Object.prototype.toString.call(scriptDeniedByNamedPolicy),
						scriptDeniedString: String(scriptDeniedByNamedPolicy),
						scriptUrlType: Object.prototype.toString.call(scriptUrl),
						scriptUrlString: String(scriptUrl),
					};
				} catch (e) {
					snapshot.ysPolicy = { ok: false, name: e.name, message: e.message };
				}
			} else {
				const html = window.yZYbk3("<b>cf</b>");
				const script = window.zjVu3("return this");
				const scriptUrl = window.cAtV0("blob:https://example.com/cf");
				snapshot.outputs = {
					htmlType: typeof html,
					htmlString: String(html),
					scriptAllowedType: typeof script,
					scriptAllowedString: String(script),
					scriptUrlType: typeof scriptUrl,
					scriptUrlString: String(scriptUrl),
				};
			}

			assert(typeof window.yZYbk3 === "function", "HTML wrapper should be callable");
			assert(typeof window.zjVu3 === "function", "script wrapper should be callable");
			assert(typeof window.cAtV0 === "function", "script URL wrapper should be callable");
			assertConsistent("trusted-types-bootstrap-policy", snapshot);
		} finally {
			if (previous.yZYbk3 === undefined) delete window.yZYbk3;
			else window.yZYbk3 = previous.yZYbk3;
			if (previous.zjVu3 === undefined) delete window.zjVu3;
			else window.zjVu3 = previous.zjVu3;
			if (previous.cAtV0 === undefined) delete window.cAtV0;
			else window.cAtV0 = previous.cAtV0;
		}
	`,
});

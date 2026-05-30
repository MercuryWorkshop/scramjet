import { basicTest } from "../../testcommon.ts";

// Exact Trusted Types method chain from payload2_lifted.js:14938-14991:
//
//   TrustedTypePolicy.prototype.createHTML
//   TrustedTypePolicy.prototype.createScript
//   TrustedTypePolicy.prototype.createScriptURL
//   TrustedTypePolicyFactory.prototype.createPolicy
//
// The lifted code reads each property and feeds typeof into the collector.

export default basicTest({
	name: "cf-trustedtypepolicy-method-typeof-chain",
	js: `
    const policyProto = window.TrustedTypePolicy && window.TrustedTypePolicy.prototype;
    const factoryProto = window.TrustedTypePolicyFactory && window.TrustedTypePolicyFactory.prototype;
    const observed = {
      trustedTypesType: typeof window.trustedTypes,
      TrustedTypePolicyType: typeof window.TrustedTypePolicy,
      TrustedTypePolicyFactoryType: typeof window.TrustedTypePolicyFactory,
      createHTML: typeof policyProto?.createHTML,
      createScript: typeof policyProto?.createScript,
      createScriptURL: typeof policyProto?.createScriptURL,
      createPolicy: typeof factoryProto?.createPolicy,
    };

    if (observed.TrustedTypePolicyType !== "undefined") {
      assert(observed.createHTML === "function", "TrustedTypePolicy.prototype.createHTML should be function");
      assert(observed.createScript === "function", "TrustedTypePolicy.prototype.createScript should be function");
      assert(observed.createScriptURL === "function", "TrustedTypePolicy.prototype.createScriptURL should be function");
    }

    if (observed.TrustedTypePolicyFactoryType !== "undefined") {
      assert(observed.createPolicy === "function", "TrustedTypePolicyFactory.prototype.createPolicy should be function");
    }

    assertConsistent("trustedtypepolicy-method-typeof-chain", observed);
  `,
});

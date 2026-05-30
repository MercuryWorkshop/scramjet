import { basicTest } from "../../testcommon.ts";

// Exact method typeof chain from payload2_lifted.js:15965-16002 and
// 16131-16155, with duplicate padded entries at 15838-15912 and 16055-16065:
//
//   window.Object.defineProperty          -> typeof, label "defineProperty"
//   window.Object.prototype.toString      -> typeof, label "toString"
//   window.Performance.prototype.now      -> typeof, label "now"
//   window.Permissions.prototype.query    -> typeof, label "query"
//   window.Node.prototype.appendChild     -> typeof, label "appendChild"
//
// The lifted output has register damage after each property read (`typeof reg_17`
// instead of the loaded property value), but the literal labels and property
// accesses identify this as the VM's intrinsic method typeof probe chain.

export default basicTest({
	name: "cf-intrinsic-method-typeof-chain",
	js: `
    const observed = {
      objectDefineProperty: typeof Object.defineProperty,
      objectPrototypeToString: typeof Object.prototype.toString,
      performanceNow: typeof Performance.prototype.now,
      permissionsQuery: typeof Permissions.prototype.query,
      nodeAppendChild: typeof Node.prototype.appendChild,
    };

    assert(observed.objectDefineProperty === "function",
      "Object.defineProperty typeof should be function, got: " + observed.objectDefineProperty);
    assert(observed.objectPrototypeToString === "function",
      "Object.prototype.toString typeof should be function, got: " + observed.objectPrototypeToString);
    assert(observed.performanceNow === "function",
      "Performance.prototype.now typeof should be function, got: " + observed.performanceNow);
    assert(observed.permissionsQuery === "function",
      "Permissions.prototype.query typeof should be function, got: " + observed.permissionsQuery);
    assert(observed.nodeAppendChild === "function",
      "Node.prototype.appendChild typeof should be function, got: " + observed.nodeAppendChild);

    assertConsistent("intrinsic-method-typeof-chain", observed);
  `,
});

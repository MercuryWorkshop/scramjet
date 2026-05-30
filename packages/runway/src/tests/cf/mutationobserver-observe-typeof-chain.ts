import { basicTest } from "../../testcommon.ts";

// Exact narrow method-type chain from payload2_lifted.js:16299-16310:
//   window.MutationObserver.prototype.observe; typeof owner/prototype is fed to
//   the damaged lifted check with literal "observe". Record both the damaged
//   owner typeof and the intended method typeof.

export default basicTest({
	name: "cf-mutationobserver-observe-typeof-chain",
	js: `
    const proto = window.MutationObserver.prototype;
    proto.observe;
    const observed = {
      ownerType: typeof proto,
      observeType: typeof proto.observe,
      observeName: proto.observe && proto.observe.name,
      observeString: proto.observe ? Function.prototype.toString.call(proto.observe) : null,
    };

    assert(observed.ownerType === "object", "MutationObserver prototype owner type mismatch");
    assert(observed.observeType === "function", "MutationObserver.observe type mismatch");
    assertConsistent("mutationobserver-observe-typeof-chain", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact XMLHttpRequest send typeof probes from payload2_lifted.js:13749-13758
// and duplicate path at 13785-13795:
//
//   window.XMLHttpRequest
//   XMLHttpRequest.prototype
//   literal "send"
//   read XMLHttpRequest.prototype.send
//   typeof probe reported with label "send"

export default basicTest({
	name: "cf-xhr-send-typeof",
	js: `
    const proto = XMLHttpRequest.prototype;
    const sendValue = proto.send;
    const observedType = typeof sendValue;

    assert(observedType === "function",
      "XMLHttpRequest.prototype.send typeof should be function, got: " + observedType);

    assertConsistent("xhr-send-typeof", {
      observedType,
    });
  `,
});

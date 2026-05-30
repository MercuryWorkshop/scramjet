import { basicTest } from "../../testcommon.ts";

// Exact own-window descriptor chain from payload2_lifted.js:13904-13978 and
// duplicate paths at 14031-14175:
//
//   read Window.prototype.postMessage, then Object.getOwnPropertyDescriptor(window, "postMessage")
//   read Window.prototype.setInterval, then Object.getOwnPropertyDescriptor(window, "setInterval")
//   read Window.prototype.setTimeout, then Object.getOwnPropertyDescriptor(window, "setTimeout")
//   for present own descriptors, read .value and typeof.

export default basicTest({
	name: "cf-window-own-timer-message-descriptors",
	js: `
    const props = ["postMessage", "setInterval", "setTimeout"];
    const descriptors = {};

    for (const prop of props) {
      const protoValue = Window.prototype[prop];
      const ownDesc = Object.getOwnPropertyDescriptor(window, prop);
      descriptors[prop] = {
        protoType: typeof protoValue,
        ownExists: !!ownDesc,
        ownValueType: ownDesc && Object.prototype.hasOwnProperty.call(ownDesc, "value") ? typeof ownDesc.value : undefined,
        ownHasGet: !!(ownDesc && ownDesc.get),
      };
      assert(typeof window[prop] === "function",
        "window." + prop + " should be function");
    }

    assertConsistent("window-own-timer-message-descriptors", descriptors);
  `,
});

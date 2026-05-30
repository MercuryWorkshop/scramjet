import { basicTest } from "../../testcommon.ts";

// Exact MouseEvent descriptor cluster from payload2_lifted.js:12324-12402
// and 12455-12484:
//
//   Object.getOwnPropertyDescriptor(MouseEvent.prototype, "clientY")
//   Object.getOwnPropertyDescriptor(MouseEvent.prototype, "screenX")
//   Object.getOwnPropertyDescriptor(MouseEvent.prototype, "clientX")
//   repeated clientY continuation
//
// The VM records labels "get clientY", "get screenX", and "get clientX".

export default basicTest({
	name: "cf-mouseevent-descriptor-client-screen",
	js: `
    const props = ["clientY", "screenX", "clientX"];
    const descriptors = {};

    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(MouseEvent.prototype, prop);
      descriptors[prop] = {
        exists: !!desc,
        hasGet: !!(desc && desc.get),
        getType: desc && desc.get ? typeof desc.get : undefined,
      };
      assert(desc !== undefined,
        "MouseEvent.prototype descriptor should exist for " + prop);
      assert(typeof desc.get === "function",
        "MouseEvent.prototype " + prop + " getter should be function");
    }

    assertConsistent("mouseevent-descriptor-client-screen", descriptors);
  `,
});

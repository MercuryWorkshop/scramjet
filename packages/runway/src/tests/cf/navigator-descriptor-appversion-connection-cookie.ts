import { basicTest } from "../../testcommon.ts";

// Exact Navigator descriptor chain from payload2_lifted.js:11827-11886,
// 11890-11915, and 12060-12069:
//
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "appVersion")
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "connection")
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "cookieEnabled")
//   Object.getOwnPropertyDescriptor(Navigator.prototype, "deviceMemory")
//
// The lifted code follows descriptor/getter existence and typeof getter paths.

export default basicTest({
	name: "cf-navigator-descriptor-appversion-connection-cookie",
	js: `
    const proto = Navigator.prototype;
    const descriptors = {
      appVersion: Object.getOwnPropertyDescriptor(proto, "appVersion"),
      connection: Object.getOwnPropertyDescriptor(proto, "connection"),
      cookieEnabled: Object.getOwnPropertyDescriptor(proto, "cookieEnabled"),
      deviceMemory: Object.getOwnPropertyDescriptor(proto, "deviceMemory"),
    };

    const observed = Object.fromEntries(Object.entries(descriptors).map(([name, descriptor]) => [
      name,
      {
        present: !!descriptor,
        getterType: typeof descriptor?.get,
        setterType: typeof descriptor?.set,
        enumerable: descriptor?.enumerable,
        configurable: descriptor?.configurable,
      },
    ]));

    assert(observed.appVersion.present, "Navigator.prototype.appVersion descriptor should exist");
    assert(observed.appVersion.getterType === "function", "appVersion getter should be function");
    assert(observed.connection.present, "Navigator.prototype.connection descriptor should exist");
    assert(observed.connection.getterType === "function", "connection getter should be function");
    assert(observed.cookieEnabled.present, "Navigator.prototype.cookieEnabled descriptor should exist");
    assert(observed.cookieEnabled.getterType === "function", "cookieEnabled getter should be function");

    assertConsistent("navigator-descriptor-appversion-connection-cookie", observed);
  `,
});

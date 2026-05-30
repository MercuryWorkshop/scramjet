import { basicTest } from "../../testcommon.ts";

// Exact MediaDevices probe from payload2_lifted.js:16285-16296:
//
//   window.MediaDevices
//   MediaDevices.prototype
//   MediaDevices.prototype.enumerateDevices
//   label literal "enumerateDevices"
//
// Lifted register damage records `typeof prototype` after the property read.
// Preserve both the damaged owner type and the intended raw method type.

export default basicTest({
	name: "cf-media-devices-enumerate-typeof",
	js: `
    const ctor = window.MediaDevices;
    const proto = ctor && ctor.prototype;
    const value = proto && proto.enumerateDevices;
    const observed = {
      constructorType: typeof ctor,
      prototypeTypeDamaged: typeof proto,
      enumerateDevicesType: typeof value,
      navigatorMediaDevicesType: typeof navigator.mediaDevices,
    };

    if (ctor) {
      assert(observed.enumerateDevicesType === "function",
        "MediaDevices.prototype.enumerateDevices should be function, got: " + observed.enumerateDevicesType);
    }

    assertConsistent("media-devices-enumerate-typeof", observed);
  `,
});

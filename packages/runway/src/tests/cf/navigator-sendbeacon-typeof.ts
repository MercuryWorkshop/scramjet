import { basicTest } from "../../testcommon.ts";

// Exact control flow from payload2_lifted.js:16313-16324:
//
// p2_func_108538_207:
//   1. reg_17 = reg_228.window
//   2. reg_20 = reg_17.Navigator
//   3. reg_17 = reg_20.prototype
//   4. reg_20 = "sendBeacon"
//   5. reg_17.sendBeacon
//   6. reg_24 = typeof reg_17
//   7. reg_20.YyXhA9(reg_24, "sendBeacon")
//
// The lifted output has register damage at step 6 (`typeof reg_17` instead of
// the loaded property value), but the surrounding literal and property access
// identify this as the Navigator.prototype.sendBeacon typeof probe.

export default basicTest({
	name: "cf-navigator-sendbeacon-typeof",
	js: `
    const proto = Navigator.prototype;
    const sendBeaconValue = proto.sendBeacon;
    const observedType = typeof sendBeaconValue;

    assert(observedType === "function",
      "Navigator.prototype.sendBeacon typeof should be function, got: " + observedType);

    assertConsistent("navigator-sendbeacon-typeof", {
      observedType,
    });
  `,
});

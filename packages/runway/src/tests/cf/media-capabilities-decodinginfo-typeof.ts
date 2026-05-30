import { basicTest } from "../../testcommon.ts";

// Exact typeof probe from payload2_lifted.js:2608-2615:
//
//   1. read navigator.mediaCapabilities
//   2. read navigator.mediaCapabilities.decodingInfo
//   3. lifted output records typeof mediaCapabilities (`typeof reg_20`) rather
//      than typeof decodingInfo; keep both raw observations and do not silently
//      correct the damaged register.

export default basicTest({
	name: "cf-media-capabilities-decodinginfo-typeof",
	js: `
    const mediaCapabilities = navigator.mediaCapabilities;
    const decodingInfo = mediaCapabilities && mediaCapabilities.decodingInfo;
    const mediaCapabilitiesType = typeof mediaCapabilities;
    const decodingInfoType = typeof decodingInfo;

    if (mediaCapabilities) {
      assert(mediaCapabilitiesType === "object",
        "navigator.mediaCapabilities typeof should be object when present, got: " + mediaCapabilitiesType);
    }

    assertConsistent("media-capabilities-decodinginfo-typeof", {
      mediaCapabilitiesType,
      decodingInfoType,
    });
  `,
});

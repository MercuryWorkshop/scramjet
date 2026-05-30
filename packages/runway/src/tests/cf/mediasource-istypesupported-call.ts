import { basicTest } from "../../testcommon.ts";

// Exact MediaSource support branch from payload2_lifted.js:2624-2632:
//
//   reg_20 = window.MediaSource
//   reg_17 = reg_20.isTypeSupported(arg_0)
//   branch on the boolean result

export default basicTest({
	name: "cf-mediasource-istypesupported-call",
	js: `
    if (typeof MediaSource === "undefined" || typeof MediaSource.isTypeSupported !== "function") {
      assertConsistent("mediasource-istypesupported-call", {
        mediaSourceType: typeof MediaSource,
        isTypeSupportedType: typeof (typeof MediaSource === "undefined" ? undefined : MediaSource.isTypeSupported),
      });
      pass("MediaSource.isTypeSupported unavailable; source has missing-support path");
    } else {
      const contentType = 'video/mp4; codecs="avc1.42E01E"';
      const supported = MediaSource.isTypeSupported(contentType);
      assert(typeof supported === "boolean",
        "MediaSource.isTypeSupported should return boolean");
      assertConsistent("mediasource-istypesupported-call", {
        contentType,
        supported,
      });
    }
  `,
});

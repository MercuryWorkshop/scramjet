import { basicTest } from "../../testcommon.ts";

// Exact video decodingInfo shape from payload2_lifted.js:2449-2464 and result
// property reads at 2467-2507:
//
//   navigator.mediaCapabilities.decodingInfo({
//     type: "file",
//     video: {
//       contentType: arg_0,
//       width: 1920,
//       height: 1080,
//       bitrate: 2646242,
//       framerate: "25",
//     },
//   }).then(result => read powerEfficient, smooth, supported).catch(...)

export default basicTest({
	name: "cf-media-capabilities-video-decodinginfo",
	js: `
    if (!navigator.mediaCapabilities || typeof navigator.mediaCapabilities.decodingInfo !== "function") {
      assertConsistent("media-capabilities-video-decodinginfo", {
        mediaCapabilitiesType: typeof navigator.mediaCapabilities,
        decodingInfoType: navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo,
      });
      pass("navigator.mediaCapabilities.decodingInfo unavailable; source has catch/fallback path");
    } else {
      const config = {
        type: "file",
        video: {
          contentType: 'video/mp4; codecs="avc1.42E01E"',
          width: 1920,
          height: 1080,
          bitrate: 2646242,
          framerate: "25",
        },
      };
      const result = await navigator.mediaCapabilities.decodingInfo(config);

      assert(typeof result.powerEfficient === "boolean",
        "powerEfficient should be boolean");
      assert(typeof result.smooth === "boolean",
        "smooth should be boolean");
      assert(typeof result.supported === "boolean",
        "supported should be boolean");

      assertConsistent("media-capabilities-video-decodinginfo", {
        config,
        result: {
          powerEfficient: result.powerEfficient,
          smooth: result.smooth,
          supported: result.supported,
        },
      });
    }
  `,
});

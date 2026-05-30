import { basicTest } from "../../testcommon.ts";

// Exact audio decodingInfo shape from payload2_lifted.js:2530-2544 and result
// property reads at 2551-2590:
//
//   navigator.mediaCapabilities.decodingInfo({
//     type: "file",
//     audio: {
//       contentType: arg_0,
//       channels: "2",
//       bitrate: 128000,
//       samplerate: 48000,
//     },
//   }).then(result => read powerEfficient, smooth, supported).catch(...)

export default basicTest({
	name: "cf-media-capabilities-audio-decodinginfo",
	js: `
    if (!navigator.mediaCapabilities || typeof navigator.mediaCapabilities.decodingInfo !== "function") {
      assertConsistent("media-capabilities-audio-decodinginfo", {
        mediaCapabilitiesType: typeof navigator.mediaCapabilities,
        decodingInfoType: navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo,
      });
      pass("navigator.mediaCapabilities.decodingInfo unavailable; source has catch/fallback path");
    } else {
      const config = {
        type: "file",
        audio: {
          contentType: 'audio/mp4; codecs="mp4a.40.2"',
          channels: "2",
          bitrate: 128000,
          samplerate: 48000,
        },
      };
      const result = await navigator.mediaCapabilities.decodingInfo(config);

      assert(typeof result.powerEfficient === "boolean",
        "powerEfficient should be boolean");
      assert(typeof result.smooth === "boolean",
        "smooth should be boolean");
      assert(typeof result.supported === "boolean",
        "supported should be boolean");

      assertConsistent("media-capabilities-audio-decodinginfo", {
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

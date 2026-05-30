import { basicTest } from "../../testcommon.ts";

// Exact audio context gate from payload2_lifted.js:28895-28913 and fallback
// probe at 28668-28687:
//
//   read window.AudioContext
//   if missing, read window.OfflineAudioContext then window.webkitOfflineAudioContext
//   when AudioContext exists, set jTgN9 = "IHiF"

export default basicTest({
	name: "cf-audio-context-gate",
	js: `
    const state = {};
    const AudioCtor = window.AudioContext;
    const observed = {
      audioContextType: typeof AudioCtor,
      offlineAudioContextType: undefined,
      webkitOfflineAudioContextType: undefined,
      jTgN9: undefined,
      branch: undefined,
    };

    if (AudioCtor) {
      state.jTgN9 = "IHiF";
      observed.jTgN9 = state.jTgN9;
      observed.branch = "audio-context";
    } else {
      const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      observed.offlineAudioContextType = typeof window.OfflineAudioContext;
      observed.webkitOfflineAudioContextType = typeof window.webkitOfflineAudioContext;
      if (!OfflineCtor) {
        state.jTgN9 = "IHiF";
        observed.jTgN9 = state.jTgN9;
        observed.branch = "no-offline-audio-context";
      } else {
        observed.branch = "offline-audio-context";
      }
    }

    assert(observed.jTgN9 === "IHiF" || observed.branch === "offline-audio-context",
      "AudioContext gate should either set jTgN9 or enter offline branch");

    assertConsistent("audio-context-gate", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact speech synthesis voice collection from payload2_lifted.js:28362-28513
// and sorting/hash prelude at 28550-28567:
//
//   window.speechSynthesis
//   speechSynthesis.getVoices
//   speechSynthesis.getVoices()
//   getVoices() again in p2_func_9463_73
//   for first/each voice, read voiceURI
//   sort collected voiceURI strings and join with "|"
//
// This is a strict observable port of the voiceURI collection. The VM has
// fallback writes when speechSynthesis or getVoices is missing.

export default basicTest({
	name: "cf-speech-synthesis-voiceuri-list",
	timeoutMs: 10000,
	js: `
    async function waitForVoices() {
      if (!window.speechSynthesis || typeof speechSynthesis.getVoices !== "function") {
        return null;
      }

      const immediate = speechSynthesis.getVoices();
      if (immediate.length > 0) return immediate;

      return await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(speechSynthesis.getVoices()), 750);
        speechSynthesis.addEventListener("voiceschanged", () => {
          clearTimeout(timeout);
          resolve(speechSynthesis.getVoices());
        }, { once: true });
      });
    }

    const voices = await waitForVoices();
    const voiceURIs = voices ? voices.map((voice) => voice.voiceURI).sort((a, b) => a.localeCompare(b)) : null;
    const observed = {
      speechSynthesisType: typeof window.speechSynthesis,
      getVoicesType: window.speechSynthesis && typeof speechSynthesis.getVoices,
      voiceCount: voices ? voices.length : 0,
      voiceURIs,
      joinedVoiceURIs: voiceURIs ? voiceURIs.join("|") : "",
    };

    assertConsistent("speech-synthesis-voiceuri-list", observed);
  `,
});

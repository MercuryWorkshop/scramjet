import { basicTest } from "../../testcommon.ts";

// Strict WebRTC offer/STUN branch from payload2_lifted.js:2332-2383 and
// callbacks at 2395-2429:
//   config { iceCandidatePoolSize: 1, iceServers: [{ urls:
//   "stun:stun.cloudflare.com:3478" }] }, createDataChannel(""), listen for
//   icegatheringstatechange and icecandidate, createOffer({ offerToReceiveAudio:
//   false, offerToReceiveVideo: false }), and push candidate.candidate strings.

export default basicTest({
	name: "cf-rtc-icecandidate-offer-stun",
	timeoutMs: 10000,
	js: `
    const config = {
      iceCandidatePoolSize: 1,
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    };
    const offerOptions = { offerToReceiveAudio: false, offerToReceiveVideo: false };
    const observed = {
      RTCPeerConnectionType: typeof window.RTCPeerConnection,
      config,
      dataChannelLabel: "",
      offerOptions,
      constructionError: null,
      offerError: null,
      offerType: null,
      iceGatheringStates: [],
      candidates: [],
    };

    let pc = null;
    try {
      if (window.RTCPeerConnection) {
        pc = new RTCPeerConnection(config);
        pc.createDataChannel("");
        pc.addEventListener("icegatheringstatechange", () => {
          observed.iceGatheringStates.push(pc.iceGatheringState);
        });
        pc.addEventListener("icecandidate", (event) => {
          if (event.candidate) observed.candidates.push(event.candidate.candidate);
        });
        try {
          const offer = await pc.createOffer(offerOptions);
          observed.offerType = offer && offer.type;
        } catch (error) {
          observed.offerError = { name: error && error.name, message: error && error.message };
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      observed.constructionError = { name: error && error.name, message: error && error.message };
    } finally {
      if (pc) pc.close();
    }

    assert(observed.RTCPeerConnectionType === "undefined" || observed.RTCPeerConnectionType === "function", "RTCPeerConnection type mismatch");
    assert(observed.config.iceServers[0].urls === "stun:stun.cloudflare.com:3478", "RTC STUN URL mismatch");
    assertConsistent("rtc-icecandidate-offer-stun", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact RTC gate from payload2_lifted.js:2204-2223:
//
//   read window.RTCPeerConnection
//   read window.RTCRtpReceiver
//   if RTCRtpReceiver exists, set bihJA5 = "eBOb2" and return
//
// The longer fallback branch only runs when RTCRtpReceiver is absent.

export default basicTest({
	name: "cf-rtc-peerconnection-receiver-gate",
	js: `
    const state = {};
    const peerConnection = window.RTCPeerConnection;
    const rtpReceiver = window.RTCRtpReceiver;
    const observed = {
      RTCPeerConnectionType: typeof peerConnection,
      RTCRtpReceiverType: typeof rtpReceiver,
      bihJA5: undefined,
      branch: undefined,
    };

    if (rtpReceiver) {
      state.bihJA5 = "eBOb2";
      observed.bihJA5 = state.bihJA5;
      observed.branch = "receiver-present";
    } else {
      observed.branch = "receiver-absent-fallback";
    }

    assert(observed.branch === "receiver-present" || observed.branch === "receiver-absent-fallback",
      "RTC receiver gate should take a known branch");

    assertConsistent("rtc-peerconnection-receiver-gate", observed);
  `,
});

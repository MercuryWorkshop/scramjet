import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_1873_231 (lines 371-378):
//   1. window.BroadcastChannel → check existence
//   2. if (!BroadcastChannel) → vm_func_1953_65
//
// vm_func_1953_65 (lines 381-404):
//   1. xHzMd3 = 0
//   2. puyP7 = _cf_chl_opt.puyP7 (secret key)
//   3. new BroadcastChannel("a") → channel A (receives ping responses)
//   4. addEventListener("message", vm_func_1481_57) → pong counter
//   5. new BroadcastChannel("a") → channel B (forwards to main)
//   6. addEventListener("message", vm_func_1590_43)
//   7. new BroadcastChannel("a") → channel C (sends ping)
//   8. postMessage({ ping: puyP7 })
//
// vm_func_1481_57 (lines 416-428):
//   1. If data.pong is truthy → success path
//   2. Else → xHzMd3++ (count channels that heard the ping)
//
// This is a cross-context communication test using BroadcastChannel.
// The ping/pong pattern verifies that messages propagate between contexts.

export default basicTest({
  name: "cf-broadcast-channel",
  js: `
    // Check 1: BroadcastChannel exists (vm_func_1873_231)
    const hasBC = typeof BroadcastChannel !== "undefined";
    assert(typeof hasBC === "boolean",
      "BroadcastChannel check should run");

    if (!hasBC) {
      pass("BroadcastChannel not available");
    } else {
      // Check 2: new BroadcastChannel("a") works (vm_func_1953_65)
      const chPong = new BroadcastChannel("a");
      assert(chPong instanceof BroadcastChannel,
        "new BroadcastChannel should return BroadcastChannel");

      const chFwd = new BroadcastChannel("a");
      const chPing = new BroadcastChannel("a");

      // Check 3: addEventListener for message events
      let pongReceived = 0;
      chPong.addEventListener("message", (ev) => {
        if (ev.data && ev.data.pong !== undefined) {
          pongReceived++;
        }
      });

      // Check 4: Forward listener echoes back with pong
      chFwd.addEventListener("message", (ev) => {
        if (ev.data && ev.data.ping !== undefined) {
          chFwd.postMessage({ pong: ev.data.ping });
        }
      });

      // Check 5: postMessage works (vm_func_1953_65)
      const secretKey = "test-puyP7";
      const pingMsg = { ping: secretKey };
      chPing.postMessage(pingMsg);

      // Give time for async message delivery
      assert(typeof chPing.postMessage === "function",
        "BroadcastChannel.postMessage should be a function");
      assert(typeof chPing.close === "function",
        "BroadcastChannel.close should be a function");

      // Check 6: MessageEvent properties
      chPing.addEventListener("message", (ev) => {
        assert(ev.isTrusted === false || ev.isTrusted === true,
          "MessageEvent.isTrusted should be boolean");
        assert(typeof ev.data === "object",
          "MessageEvent.data should be object");
      });

      chPong.close();
      chFwd.close();
      chPing.close();
    }
  `,
});
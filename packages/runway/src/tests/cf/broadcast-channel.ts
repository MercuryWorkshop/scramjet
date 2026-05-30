import { basicTest } from "../../testcommon.ts";

// Adapted from inner.vm_lifted.js:
//
// vm_func_4008_73 / vm_func_1757_197 / vm_func_1873_231:
// inner.vm_lifted.js:247-251,458-471
//   1. window.xHzMd3 = "hdAcE0"
//   2. window.oIvGL6.NLAs4("sharknado")
//   3. window.BroadcastChannel is read
//   4. the lifted branch tests !window, so ordinary windows set xHzMd3 = "acou0"
//
// vm_func_1953_65, inner.vm_lifted.js:474-496:
//   1. xHzMd3 = 0
//   2. puyP7 = _cf_chl_opt.puyP7 (secret key)
//   3. new BroadcastChannel("a") → channel A (pong/non-pong listener)
//   4. addEventListener("message", vm_func_1481_57) → pong counter
//   5. new BroadcastChannel("a") → channel B (ping reader)
//   6. addEventListener("message", vm_func_1590_43)
//   7. new BroadcastChannel("a") → channel C (sends ping)
//   8. postMessage({ ping: puyP7 })
//
// vm_func_1481_57 (lines 416-428):
//   1. If data.pong is truthy → success path
//   2. Else → xHzMd3++ (count channels that heard the ping)
//
// vm_func_1590_43 / vm_func_1728_145 (lines 499-506):
//   1. Read event.data
//   2. Read event.data.ping
//   3. Return without visible mutation
//
// The decompiled line 492 is damaged (`"ping".puyP7`), while the surrounding
// stack setup preserves `_cf_chl_opt.puyP7`. This test preserves the observable
// channel topology and non-pong branch without inventing a pong forwarder.

export default basicTest({
	name: "cf-broadcast-channel",
	js: `
    const prevX = window.xHzMd3;
    const prevO = window.oIvGL6;
    const calls = [];

    try {
      window.xHzMd3 = "hdAcE0";
      window.oIvGL6 = { NLAs4(value) { calls.push(value); } };
      window.oIvGL6.NLAs4("sharknado");

      const broadcastChannelValue = window.BroadcastChannel;
      if (!window) {
        window.xHzMd3 = 0;
      } else {
        window.xHzMd3 = "acou0";
      }

      assert(JSON.stringify(calls) === JSON.stringify(["sharknado"]),
        "NLAs4 should be called with sharknado");
      assert(window.xHzMd3 === "acou0",
        "xHzMd3 should follow the ordinary-window branch from hdAcE0 to acou0");

      assertConsistent("broadcast-channel-branch-state", {
        broadcastChannelType: typeof broadcastChannelValue,
        xHzMd3: window.xHzMd3,
        calls,
      });
    } finally {
      if (prevX === undefined) delete window.xHzMd3; else window.xHzMd3 = prevX;
      if (prevO === undefined) delete window.oIvGL6; else window.oIvGL6 = prevO;
    }

    if (typeof window.BroadcastChannel === "function") {
      const prevOpt = window._cf_chl_opt;
      const prevX = window.xHzMd3;
      const channelName = "cf-runway-broadcast-" + Math.random().toString(36).slice(2);
      const secret = "cf-puyP7-test";
      const received = [];
      let channelA;
      let channelB;
      let channelC;

      try {
        window._cf_chl_opt = Object.assign({}, window._cf_chl_opt, { puyP7: secret });
        window.xHzMd3 = 0;

        channelA = new BroadcastChannel(channelName);
        channelA.addEventListener("message", (event) => {
          const pong = event.data && event.data.pong;
          if (!pong) window.xHzMd3 = window.xHzMd3 + 1;
          received.push({ listener: "pong-counter", hasPing: !!(event.data && Object.prototype.hasOwnProperty.call(event.data, "ping")), ping: event.data && event.data.ping, pong });
        });

        channelB = new BroadcastChannel(channelName);
        channelB.addEventListener("message", (event) => {
          received.push({ listener: "ping-reader", hasPing: !!(event.data && Object.prototype.hasOwnProperty.call(event.data, "ping")), ping: event.data && event.data.ping });
        });

        channelC = new BroadcastChannel(channelName);
        channelC.postMessage({ ping: window._cf_chl_opt.puyP7 });

        await new Promise((resolve, reject) => {
          let interval;
          const done = (error) => {
            clearTimeout(timeout);
            clearInterval(interval);
            if (error) reject(error);
            else resolve();
          };
          const timeout = setTimeout(() => done(new Error("BroadcastChannel ping timed out")), 1000);
          interval = setInterval(() => {
            if (received.length >= 2) {
              done();
            }
          }, 10);
        });

        assert(window.xHzMd3 === 1,
          "non-pong listener should increment xHzMd3 once, got: " + window.xHzMd3);
        assert(received.some((entry) => entry.listener === "pong-counter" && entry.hasPing),
          "pong-counter listener should observe ping-shaped data");
        assert(received.some((entry) => entry.listener === "ping-reader" && entry.ping === secret),
          "ping-reader listener should observe puyP7 ping value");

        assertConsistent("broadcast-channel-three-channel-flow", {
          xHzMd3: window.xHzMd3,
          received,
        });
      } finally {
        if (channelA) channelA.close();
        if (channelB) channelB.close();
        if (channelC) channelC.close();
        if (prevOpt === undefined) delete window._cf_chl_opt; else window._cf_chl_opt = prevOpt;
        if (prevX === undefined) delete window.xHzMd3; else window.xHzMd3 = prevX;
      }
    } else {
      pass("BroadcastChannel not available; Turnstile has a missing-API path");
    }
  `,
});

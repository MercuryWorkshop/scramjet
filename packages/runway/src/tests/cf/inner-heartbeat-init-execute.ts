import { basicTest } from "../../testcommon.ts";

// Exact heartbeat listener from inner.js_translated.js:1044-1080:
//
//   T = q.data;
//   T && T.source === "cloudflare-challenge" && T.event === "init"
//     ? dl = setInterval(function() { dG(); }, 1e3)
//     : T && T.source === "cloudflare-challenge" && T.event === "execute" && clearInterval(dl);

export default basicTest({
	name: "cf-inner-heartbeat-init-execute",
	js: `
    const previousSetInterval = window.setInterval;
    const previousClearInterval = window.clearInterval;

    try {
      const scheduled = [];
      const callbacks = [];
      const cleared = [];
      let nextId = 1200;
      let dl;
      let heartbeatCalls = 0;

      window.setInterval = function(callback, delay) {
        const id = nextId++;
        scheduled.push({ id, delay, callbackType: typeof callback });
        callbacks.push(callback);
        return id;
      };
      window.clearInterval = function(id) {
        cleared.push(id);
      };
      function dG() { heartbeatCalls++; }

      window.addEventListener("message", function(q) {
        const T = q.data;
        if (T && T.source === "cloudflare-challenge" && T.event === "init") {
          dl = setInterval(function() { dG(); }, 1000);
        } else if (T && T.source === "cloudflare-challenge" && T.event === "execute") {
          clearInterval(dl);
        }
      });

      window.dispatchEvent(new MessageEvent("message", { data: { source: "ignored", event: "init" } }));
      window.dispatchEvent(new MessageEvent("message", { data: { source: "cloudflare-challenge", event: "init" } }));
      callbacks[0]();
      window.dispatchEvent(new MessageEvent("message", { data: { source: "cloudflare-challenge", event: "execute" } }));

      const observed = { scheduled, cleared, heartbeatCalls };
      assert(scheduled.length === 1, "init should schedule exactly one heartbeat interval");
      assert(scheduled[0].delay === 1000, "heartbeat delay should be 1000ms");
      assert(cleared.length === 1 && cleared[0] === scheduled[0].id, "execute should clear the scheduled interval");
      assert(heartbeatCalls === 1, "heartbeat callback should call dG");
      assertConsistent("inner-heartbeat-init-execute", observed);
    } finally {
      window.setInterval = previousSetInterval;
      window.clearInterval = previousClearInterval;
    }
  `,
});

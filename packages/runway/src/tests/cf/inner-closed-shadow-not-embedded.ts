import { basicTest } from "../../testcommon.ts";

// Body/closed-shadow/not-embedded path from inner.js_translated.js:5790-5799:
// after body is ready, Turnstile attaches a closed shadow root to body; if the
// frame is not embedded (top == self or !parent), it reports not_embedded and
// runs the failure path instead of continuing parent protocol setup.

export default basicTest({
	name: "cf-inner-closed-shadow-not-embedded",
	js: `
    const previousCfOpt = window._cf_chl_opt;
    const host = document.createElement("div");

    try {
      const calls = [];
      document.body.appendChild(host);
      const notEmbeddedWindow = {};
      const b = { top: notEmbeddedWindow, self: notEmbeddedWindow, parent: null, _cf_chl_opt: {} };
      const I = { body: host };
      function q2() { calls.push("q2"); }
      function du(reason) { calls.push(["du", reason]); }
      function d9() { calls.push("d9"); }

      if (!I.body) throw new Error("body should be ready in runway basicTest");
      q2();
      b._cf_chl_opt.kobE3 = I.body.attachShadow({ mode: "closed" });
      if (b.top === b.self || !b.parent) {
        du("not_embedded");
        d9();
      }

      const observed = {
        shadowRootType: Object.prototype.toString.call(b._cf_chl_opt.kobE3),
        hostShadowRootAccessible: I.body.shadowRoot === null,
        calls,
      };

      assert(observed.shadowRootType === "[object ShadowRoot]", "closed shadow root should be created");
      assert(observed.hostShadowRootAccessible === true, "closed shadow root should not be exposed as host.shadowRoot");
      assert(JSON.stringify(calls) === JSON.stringify(["q2", ["du", "not_embedded"], "d9"]), "not_embedded path calls mismatch");
      assertConsistent("inner-closed-shadow-not-embedded", observed);
    } finally {
      host.remove();
      if (previousCfOpt === undefined) delete window._cf_chl_opt;
      else window._cf_chl_opt = previousCfOpt;
    }
  `,
});

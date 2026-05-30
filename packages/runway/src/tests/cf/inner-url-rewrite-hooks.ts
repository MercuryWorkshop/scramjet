import { basicTest } from "../../testcommon.ts";

// Ports pass-through/hook wrappers gQ()/gO() from data4/inner.js_translated.js:4091-4098 and 5494-5500.

export default basicTest({
	name: "cf-inner-url-rewrite-hooks",
	js: `
    function gQ(env, q) { const W = env.cAtV0; return W ? W(q) : q; }
    function gO(env, q) { const W = env.zjVu3; return W ? W(q) : q; }

    const observed = {
      gQPass: gQ({}, "blob:plain"),
      gQHook: gQ({ cAtV0: (q) => "rewritten:" + q }, "blob:url"),
      gOPass: gO({}, "https://plain.test/"),
      gOHook: gO({ zjVu3: (q) => q.replace("https://", "hooked://") }, "https://plain.test/"),
    };

    assert(observed.gQHook === "rewritten:blob:url", "gQ should call cAtV0 hook when present");
    assert(observed.gOHook === "hooked://plain.test/", "gO should call zjVu3 hook when present");
    assertConsistent("inner-url-rewrite-hooks", observed);
  `,
});

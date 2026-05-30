import { basicTest } from "../../testcommon.ts";

// Ports M() from data4/inner.js_translated.js:4562-4570.

export default basicTest({
	name: "cf-inner-randomuuid-fallback-helper",
	js: `
    function M(b) {
      return b.crypto && b.crypto.randomUUID ? b.crypto.randomUUID() : "";
    }

    const observed = {
      fallback: M({ crypto: {} }),
      uuid: M({ crypto: { randomUUID: () => "uuid-123" } }),
    };

    assert(observed.fallback === "", "missing randomUUID should fall back to empty string");
    assert(observed.uuid === "uuid-123", "randomUUID result should be returned");
    assertConsistent("inner-randomuuid-fallback-helper", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact translated function body from inner.js_translated.js:4562-4570:
//
//   return b.crypto && b.crypto.randomUUID ? b.crypto.randomUUID() : "";

export default basicTest({
	name: "cf-crypto-randomuuid-fallback",
	js: `
    function exactRandomUUIDBranch(b) {
      return b.crypto && b.crypto.randomUUID ? b.crypto.randomUUID() : "";
    }

    const first = exactRandomUUIDBranch(window);
    const second = exactRandomUUIDBranch(window);
    const randomUUIDType = window.crypto && typeof window.crypto.randomUUID;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const observed = {
      cryptoType: typeof window.crypto,
      randomUUIDType,
      firstShape: first === "" ? "empty" : uuidPattern.test(first),
      secondShape: second === "" ? "empty" : uuidPattern.test(second),
      differ: first !== "" && second !== "" ? first !== second : null,
    };

    if (randomUUIDType === "function") {
      assert(observed.firstShape === true, "first randomUUID should be UUID-like");
      assert(observed.secondShape === true, "second randomUUID should be UUID-like");
      assert(observed.differ === true, "consecutive randomUUID calls should differ");
    } else {
      assert(first === "" && second === "", "fallback should return empty string");
    }

    assertConsistent("crypto-randomuuid-fallback", observed);
  `,
});

import { basicTest } from "../../testcommon.ts";

// Ports dG()/dc timestamp update from data4/inner.js_translated.js:7098-7100 and 7207-7213.

export default basicTest({
	name: "cf-inner-timestamp-heartbeat-update",
	js: `
    const previousNow = Date.now;
    try {
      let dY = 0;
      function dc(q) { dY = q; }
      function dG() { dc(Date.now()); }
      Date.now = () => 424242;
      dG();
      const observed = { dY };
      assert(dY === 424242, "dG should store Date.now through dc");
      assertConsistent("inner-timestamp-heartbeat-update", observed);
    } finally {
      Date.now = previousNow;
    }
  `,
});

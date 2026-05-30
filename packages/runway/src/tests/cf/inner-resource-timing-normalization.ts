import { basicTest } from "../../testcommon.ts";

// Ports q1 resource timing normalization from data4/inner.js_translated.js:7217-7247.

export default basicTest({
	name: "cf-inner-resource-timing-normalization",
	js: `
    const opt = { ttCoO6: [] };
    function q1(W) {
      if (!W) return;
      const T = Math.floor(W.responseStart - W.requestStart);
      const f = Math.floor(W.responseEnd - W.responseStart);
      const S = Math.floor(W.duration);
      const E = { n: W.name, dlt: f, ttfb: T, dur: S, ts: W.transferSize, bs: W.encodedBodySize };
      opt.ttCoO6?.push(E);
    }

    q1(null);
    q1({ name: "https://example.test/api.js", requestStart: 10.2, responseStart: 42.9, responseEnd: 50.7, duration: 99.8, transferSize: 1234, encodedBodySize: 567 });
    const observed = { length: opt.ttCoO6.length, entry: opt.ttCoO6[0] };

    assert(observed.length === 1, "q1 should ignore null and push one timing entry");
    assert(observed.entry.ttfb === 32 && observed.entry.dlt === 7 && observed.entry.dur === 99, "timings should be floored deltas");
    assertConsistent("inner-resource-timing-normalization", observed);
  `,
});

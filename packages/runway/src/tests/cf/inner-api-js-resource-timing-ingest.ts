import { basicTest } from "../../testcommon.ts";

// Optional apiJsResourceTiming ingest from inner.js_translated.js:5920:
//
//   qg.apiJsResourceTiming && q1(qg.apiJsResourceTiming)

export default basicTest({
	name: "cf-inner-api-js-resource-timing-ingest",
	js: `
    const ingested = [];
    function q1(value) { ingested.push(value); }

    function applyExtraParams(qg) {
      if (qg.apiJsResourceTiming) q1(qg.apiJsResourceTiming);
    }

    applyExtraParams({});
    applyExtraParams({ apiJsResourceTiming: null });
    applyExtraParams({ apiJsResourceTiming: { name: "api.js", initiatorType: "script", durationType: "number" } });

    const observed = {
      ingestCount: ingested.length,
      firstName: ingested[0] && ingested[0].name,
      firstInitiatorType: ingested[0] && ingested[0].initiatorType,
      firstDurationType: ingested[0] && ingested[0].durationType,
    };

    assert(observed.ingestCount === 1, "apiJsResourceTiming should ingest truthy timing object once");
    assert(observed.firstName === "api.js", "apiJsResourceTiming object should be passed through");
    assertConsistent("inner-api-js-resource-timing-ingest", observed);
  `,
});

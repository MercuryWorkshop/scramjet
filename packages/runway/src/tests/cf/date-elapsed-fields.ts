import { basicTest } from "../../testcommon.ts";

// Exact elapsed-time field writes from payload2_lifted.js:1224-1241:
//
//   arg_0[0].YLYw5 is the prior timestamp
//   Date.now() is read into reg_22
//   arg_0[arg_0.ufKG9].UJgT9 = arg_0[0].YLYw5
//   arg_0[arg_0.ufKG9].jOvG7 = reg_22
//   arg_0[arg_0.ufKG9].fGdh0 = reg_22 - arg_0[0].YLYw5
//   arg_0[arg_0.ufKG9].YLYw5 = arg_0.ufKG9

export default basicTest({
	name: "cf-date-elapsed-fields",
	js: `
    const start = Date.now() - 7;
    const arg0 = [{ YLYw5: start }];
    arg0.ufKG9 = "elapsedBucket";
    arg0[arg0.ufKG9] = {};

    const now = Date.now();
    arg0[arg0.ufKG9].UJgT9 = arg0[0].YLYw5;
    arg0[arg0.ufKG9].jOvG7 = now;
    arg0[arg0.ufKG9].fGdh0 = now - arg0[0].YLYw5;
    arg0[arg0.ufKG9].YLYw5 = arg0.ufKG9;

    const out = arg0[arg0.ufKG9];
    assert(out.UJgT9 === start, "UJgT9 should copy prior YLYw5");
    assert(out.jOvG7 === now, "jOvG7 should store current Date.now value");
    assert(out.fGdh0 === out.jOvG7 - out.UJgT9, "fGdh0 should be elapsed delta");
    assert(out.YLYw5 === arg0.ufKG9, "YLYw5 should be overwritten with ufKG9 key");

    assertConsistent("date-elapsed-fields", {
      elapsedType: typeof out.fGdh0,
      elapsedNonNegative: out.fGdh0 >= 0,
      finalYLYw5: out.YLYw5,
      keys: Object.keys(out).sort().join(","),
    });
  `,
});

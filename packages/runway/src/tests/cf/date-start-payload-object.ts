import { basicTest } from "../../testcommon.ts";

// Exact object creation from payload2_lifted.js:1184-1200:
//
//   arg_0.ufKG9 = "YyXhA9"
//   arg_0[arg_0.ufKG9] = {
//     KkUc0: "wpFyI8OaGsOkcn4=",
//     iThvl9: "qbKr6yzRBWkWqu1iXUeMCDZTfkGcp53IEh9ddNhZxXg",
//     sOfO7: <large exact token>,
//     YLYw5: Date.now()
//   }
//   damaged stack context also writes globalThis = "kLPkaj9"; this test records
//   only the local object fields.

export default basicTest({
	name: "cf-date-start-payload-object",
	js: `
    const arg0 = {};
    const before = Date.now();
    arg0.ufKG9 = "YyXhA9";
    arg0[arg0.ufKG9] = {
      KkUc0: "wpFyI8OaGsOkcn4=",
      iThvl9: "qbKr6yzRBWkWqu1iXUeMCDZTfkGcp53IEh9ddNhZxXg",
      sOfO7: "AHAQ2SEfnJF7NMqf2L_4dOS982BLFBJOS4EHm.UfW6s-1779715219-1.3.1.1-jCw86ZL__j2IBPk0YP.ToOwMOMXK.UDhr1ar7J3sBQJe9TOpJIkb75XrtMHg63Y7fdM_dgtzXA8mE_QgJiMkH59cPffs9D_G0BDCqmQ6CpXqeDIZmI43Q6M9Z0UoTGyTaQvbu8S.uJvxe5P1NdTi9d.FZLwE9NOup6iztnFly8kIaRgPz7VPfUvKhvPcCXnd9XR3gpXIQHW8DRCD.ApS0e85t8Fm__Xu_Y5lQRmglo3Lyjw63F4vDzHRpW1v11Jc8LXwVCkAKrCOUR7FCLRKR9OgMGoX45kuKePuxvI.d9qHIebIpaIdvA9qP7jwwtnXTeRQ7ZUlJnZR1Z74BqpgBmJUMqcodw.8U9C9HexRuen0KslBFU4WKwLrZrLrEyFqw6rxKwmrRERGRJu79KHQzLR6WSjgGX4ZU0SFxT1PUqfueB9qA8ljY3zFgC3FIR08v6zLj83Oa0XemF4J3CTP1ZT0W4ymtfoh9WF5CszyhHkm1JUHgWBw_dnVpZVDoOLTz9WWNpoQo_V1DvQeV8nRfbOHNj976vUWj7Il.mOPCZISsHDmDIXDtvYxdi_938tYPqK.FJUrppRo35Un.DpwEmuwpGGPGzlBFTRoS2gmZwUGXIOR5F.7RKTClWhStQ8kc3P9kbj3ZcLqvRTq_qtIyIm4efD8_AIto8raYIUARTOO7xzqQLFVIUmav605T9CGIoG7WLvjMBaeyJTiYFV2rP94HbiEFFOsvuaUS7BtL3QeRPTSEiG2M1AUyp2qk_9v",
      YLYw5: Date.now(),
    };
    const after = Date.now();
    const payload = arg0[arg0.ufKG9];

    assert(arg0.ufKG9 === "YyXhA9", "ufKG9 should be literal YyXhA9");
    assert(payload.KkUc0 === "wpFyI8OaGsOkcn4=", "KkUc0 literal mismatch");
    assert(payload.iThvl9 === "qbKr6yzRBWkWqu1iXUeMCDZTfkGcp53IEh9ddNhZxXg", "iThvl9 literal mismatch");
    assert(payload.sOfO7.indexOf("AHAQ2SEfnJF7NMqf2L_4dOS982BLFBJOS4EHm.UfW6s-1779715219") === 0,
      "sOfO7 should preserve exact token prefix");
    assert(typeof payload.YLYw5 === "number" && payload.YLYw5 >= before && payload.YLYw5 <= after,
      "YLYw5 should be Date.now() within construction bounds");

    assertConsistent("date-start-payload-object", {
      ufKG9: arg0.ufKG9,
      KkUc0: payload.KkUc0,
      iThvl9: payload.iThvl9,
      sOfO7Length: payload.sOfO7.length,
      YLYw5Type: typeof payload.YLYw5,
    });
  `,
});

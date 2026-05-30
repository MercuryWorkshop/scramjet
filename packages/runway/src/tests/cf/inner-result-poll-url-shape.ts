import { basicTest } from "../../testcommon.ts";

// Ports gp() polling URL construction from data4/inner.js_translated.js:7604-7608.

export default basicTest({
	name: "cf-inner-result-poll-url-shape",
	js: `
    function url(opt) {
      return "/cdn-cgi/challenge-platform/h/" + opt.ofCH0 + "/flow/ov1/result/" + opt.puyP7;
    }
    const observed = { url: url({ ofCH0: "h2", puyP7: "ray-poll" }) };
    assert(observed.url === "/cdn-cgi/challenge-platform/h/h2/flow/ov1/result/ray-poll", "poll URL should include ofCH0 and ray id");
    assertConsistent("inner-result-poll-url-shape", observed);
  `,
});

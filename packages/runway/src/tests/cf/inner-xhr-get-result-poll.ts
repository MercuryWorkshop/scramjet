import { basicTest } from "../../testcommon.ts";

// Exact XHR GET result poll from inner.js_translated.js:7604-7615.
// URL prefix/suffix aliases are explicit local test constants; branch flow and
// readyState/status/responseText sink are preserved.

export default basicTest({
	name: "cf-inner-xhr-get-result-poll",
	js: `
    const calls = [];
    const opt = { puyP7: "ray-get-poll", ofCH0: "b" };
    window._cf_chl_opt = opt;
    window.oIvGL6 = { cYmZ6(value) { calls.push(["cYmZ6", value]); } };

    function FakeXMLHttpRequest() {
      this.readyState = 4;
      this.status = 200;
      this.responseText = "poll-response-text";
    }
    FakeXMLHttpRequest.prototype.open = function(method, url) { calls.push(["open", method, url]); this.method = method; this.url = url; };
    FakeXMLHttpRequest.prototype.send = function() { calls.push(["send"]); this.onreadystatechange(); };

    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = FakeXMLHttpRequest;
    try {
      const prefix = "/cdn-cgi/challenge-platform/h/";
      const suffix = "/result/";
      const D = window._cf_chl_opt.puyP7;
      const N = window._cf_chl_opt.ofCH0;
      const q6 = prefix + N + suffix + D;
      const S = new window.XMLHttpRequest();
      S.open("GET", q6);
      S.onreadystatechange = function() {
        if (S.readyState !== 4) return;
        if (S.status != 200 && S.status !== 304) return;
        window.oIvGL6.cYmZ6(S.responseText);
      };
      S.send();

      const observed = { calls, method: S.method, url: S.url, responseText: S.responseText };
      assert(observed.method === "GET", "poll XHR method mismatch");
      assert(observed.url === "/cdn-cgi/challenge-platform/h/b/result/ray-get-poll", "poll XHR URL mismatch");
      assert(calls.some((call) => call[0] === "cYmZ6" && call[1] === "poll-response-text"), "poll response sink mismatch");
      assertConsistent("inner-xhr-get-result-poll", observed);
    } finally {
      window.XMLHttpRequest = OriginalXHR;
      delete window._cf_chl_opt;
      delete window.oIvGL6;
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Exact XHR POST setup and status-400 fail post path from inner.js_translated.js:3068-3121
// and 3127-3136. Header aliases resolve to cf-chl and cf-chl-ra at 3093-3094.

export default basicTest({
	name: "cf-inner-xhr-post-challenge-shape",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const opts = {
      xpbnF3: "runway-widget-xhr-post",
      RSQQj0: "rsqq-runway",
      Lgky2: "rcv-xhr-post",
      VNUtN0: "out-xhr-post",
      IWdn9: "outs-xhr-post",
      qxzT2: "frmd-xhr-post",
    };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(\`
        window.__xhrRecords = [];
        function FakeXMLHttpRequest() {
          this.headers = [];
          this.status = 400;
          window.__xhrRecords.push(this);
        }
        FakeXMLHttpRequest.prototype.open = function(method, url) { this.method = method; this.url = url; };
        FakeXMLHttpRequest.prototype.setRequestHeader = function(name, value) { this.headers.push([name, value]); };
        window.XMLHttpRequest = FakeXMLHttpRequest;
        window.__runXhrPost = function(q, T, J) {
          T = T || 0;
          var D = new window.XMLHttpRequest();
          D.open('POST', q);
          D.timeout = 5e3 * (1 + T);
          D.ontimeout = function() {};
          D.setRequestHeader('cf-chl', window._cf_chl_opt.RSQQj0);
          D.setRequestHeader('cf-chl-ra', J);
          D.onreadystatechange = function() {
            var q6 = '600010';
            if (D.status === 400) {
              window.parent.postMessage({
                source: 'cloudflare-challenge',
                widgetId: window._cf_chl_opt.xpbnF3,
                event: 'fail',
                rcV: window._cf_chl_opt.Lgky2,
                code: q6,
                cfChlOut: window._cf_chl_opt.VNUtN0,
                cfChlOutS: window._cf_chl_opt.IWdn9,
                frMd: window._cf_chl_opt.qxzT2
              }, '*');
            }
          };
          D.onreadystatechange();
        };
      \`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("xhr post fail timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "fail") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            const xhr = child.__xhrRecords[0];
            resolve({
              sourceMatchesIframe: event.source === child,
              origin: event.origin,
              xhr: { method: xhr.method, url: xhr.url, timeout: xhr.timeout, headers: xhr.headers },
              data: event.data,
            });
          }
        };
        window.addEventListener("message", listener);
        child.__runXhrPost("/challenge-post-runway", 1, "retry-1");
      });

      assert(result.xhr.method === "POST", "XHR method mismatch");
      assert(result.xhr.timeout === 10000, "XHR timeout formula mismatch");
      assert(result.xhr.headers[0][0] === "cf-chl", "first XHR header name mismatch");
      assert(result.xhr.headers[1][0] === "cf-chl-ra", "second XHR header name mismatch");
      assert(result.data.code === "600010", "XHR status-400 fail code mismatch");
      assertConsistent("inner-xhr-post-challenge-shape", result);
    } finally {
      iframe.remove();
    }
  `,
});

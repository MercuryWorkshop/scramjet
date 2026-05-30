import { basicTest } from "../../testcommon.ts";

// reloadApiJsRejected cached-extraParams resume branch from
// inner.js_translated.js:5807-5847. A mismatched extraParams event caches D/Z and
// posts reloadApiJsRequest; reloadApiJsRejected resumes q7(D, Z, attempts, count)
// only when source, widgetId, parent window, and origin still match.

export default basicTest({
	name: "cf-inner-reload-api-js-rejected-resume",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const widgetId = "runway-widget-reload-rejected";

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId };
      child.eval(\`
        var f = 'expected-challenge-hash';
        var S = false;
        var N = false;
        var D = null;
        var Z = '';
        var q7Calls = [];
        var q9Calls = 0;
        function Y() { return false; }
        function h() {
          window.parent.postMessage({ event: 'reloadApiJsRequest', source: 'cloudflare-challenge', widgetId: window._cf_chl_opt.xpbnF3 }, '*');
        }
        function q7(qg, origin, attempts, completed) {
          D = null;
          Z = '';
          N = true;
          q7Calls.push({ action: qg.action, ch: qg.ch, origin, attempts, completed });
        }
        function q9() { q9Calls++; }
        window.addEventListener('message', function(qg) {
          const qq = qg.data;
          if (qq.source !== 'cloudflare-challenge' || qq.widgetId !== window._cf_chl_opt.xpbnF3) return;
          if (qq.event === 'reloadApiJsRejected') {
            if (S) return;
            if (!D || qg.origin !== Z || qg.source !== window.parent) return;
            S = true;
            q7(D, Z, qq.apiJsMismatchReloadAttempts || 0, qq.apiJsMismatchReloadCompletedCount || 0);
            q9();
            return;
          }
          if (qq.event === 'extraParams') {
            if (N) return;
            if (D) return;
            if (qq.ch !== f && !S && !Y('api_js_mismatch_reload')) {
              D = qq;
              Z = qg.origin;
              h();
              return;
            }
            q7(qq, qg.origin, qq.apiJsMismatchReloadAttempts || 0, qq.apiJsMismatchReloadCompletedCount || 0);
            q9();
          }
        });
        window.__reloadRejectedState = function() { return { q7Calls: q7Calls.slice(), q9Calls, cached: !!D, S, N, Z }; };
      \`);

      const request = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("reloadApiJsRequest timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "reloadApiJsRequest") {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ origin: event.origin, data: event.data });
          }
        };
        window.addEventListener("message", listener);
        child.postMessage({ source: "cloudflare-challenge", widgetId, event: "extraParams", action: "cached-action", ch: "mismatched-hash" }, "*");
      });

      child.postMessage({ source: "cloudflare-challenge", widgetId, event: "reloadApiJsRejected", apiJsMismatchReloadAttempts: 4, apiJsMismatchReloadCompletedCount: 3 }, "*");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const state = child.__reloadRejectedState();
      const normalizedState = {
        ...state,
        ZType: typeof state.Z,
        ZLengthPositive: state.Z.length > 0,
        Z: undefined,
        q7Calls: state.q7Calls.map((call) => ({
          action: call.action,
          ch: call.ch,
          originType: typeof call.origin,
          originLengthPositive: call.origin.length > 0,
          attempts: call.attempts,
          completed: call.completed,
        })),
      };
      const observed = { requestData: request.data, requestOriginType: typeof request.origin, state: normalizedState };
      assert(request.data.source === "cloudflare-challenge", "reloadApiJsRequest source mismatch");
      assert(state.q7Calls.length === 1, "reloadApiJsRejected should resume cached extraParams exactly once");
      assert(state.q7Calls[0].action === "cached-action", "cached extraParams should be passed to q7");
      assert(state.q7Calls[0].attempts === 4 && state.q7Calls[0].completed === 3, "mismatch reload counters should be forwarded");
      assert(state.q9Calls === 1, "q9 should run after resumed q7");
      assert(state.cached === false && state.S === true && state.N === true, "cached state should clear and mark resumed");
      assertConsistent("inner-reload-api-js-rejected-resume", observed);
    } finally {
      iframe.remove();
    }
  `,
});

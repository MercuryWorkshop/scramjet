import { basicTest } from "../../testcommon.ts";

// Strict click-listener feedbackInit ports from inner.js_translated.js:6853-6892
// and 7548-7571. Hidden aliases are resolved from surrounding source where literal:
// source="cloudflare-challenge", event="feedbackInit", verifying origin literal.

export default basicTest({
	name: "cf-inner-feedback-init-clicks",
	timeoutMs: 10000,
	js: `
    const iframe = document.createElement("iframe");
    const opts = { xpbnF3: "runway-widget-feedback", puyP7: "ray-feedback" };

    try {
      document.body.appendChild(iframe);
      const child = iframe.contentWindow;
      child._cf_chl_opt = opts;
      child.eval(\`
        var failureOrigin = 'failure';
        var troubleshoot = document.createElement('a');
        troubleshoot.id = 'fr-troubleshoot-link';
        document.body.appendChild(troubleshoot);
        troubleshoot.addEventListener('click', function() {
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            rayId: window._cf_chl_opt.puyP7,
            feedbackOrigin: failureOrigin.replaceAll('_', ''),
            event: 'feedbackInit'
          }, '*');
        });

        var wrapper = document.createElement('div');
        wrapper.id = 'fr-helper-loop-wrapper';
        wrapper.classList.add('error-message-sm');
        var span = document.createElement('span');
        span.id = 'fr-helper-loop';
        span.className = 'fr-helper-loop';
        var link = document.createElement('a');
        link.href = '#refresh';
        wrapper.appendChild(span);
        wrapper.appendChild(link);
        wrapper.addEventListener('click', function() {
          window.parent.postMessage({
            source: 'cloudflare-challenge',
            widgetId: window._cf_chl_opt.xpbnF3,
            rayId: window._cf_chl_opt.puyP7,
            feedbackOrigin: 'verifying',
            event: 'feedbackInit'
          }, '*');
        });
        document.body.appendChild(wrapper);
      \`);

      const result = await new Promise((resolve, reject) => {
        const messages = [];
        const timeout = setTimeout(() => reject(new Error("feedbackInit messages timed out")), 3000);
        const listener = (event) => {
          if (event.source === child && event.data && event.data.event === "feedbackInit") {
            messages.push({ origin: event.origin, data: event.data });
          }
          if (messages.length === 2) {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve({ sourceMatchesIframe: event.source === child, messages });
          }
        };
        window.addEventListener("message", listener);
        child.document.getElementById("fr-troubleshoot-link").click();
        child.document.getElementById("fr-helper-loop-wrapper").click();
      });

      assert(result.messages[0].data.feedbackOrigin === "failure", "failure feedbackOrigin mismatch");
      assert(result.messages[1].data.feedbackOrigin === "verifying", "verifying feedbackOrigin mismatch");
      assertConsistent("inner-feedback-init-clicks", result);
    } finally {
      iframe.remove();
    }
  `,
});

import { basicTest } from "../../testcommon.ts";

// Ports verifying helper-loop feedback DOM from data4/inner.js_translated.js:7548-7571.

export default basicTest({
	name: "cf-inner-helper-loop-feedback-dom",
	timeoutMs: 10000,
	js:
		`
    const widgetId = "runway-widget-helper-loop";
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    try {
      const child = iframe.contentWindow;
      child._cf_chl_opt = { xpbnF3: widgetId, puyP7: "ray-helper", ZAvY1: true };
      const verifyingMsg = child.document.createElement("div");
      verifyingMsg.id = "verifying-msg";
      child.document.body.appendChild(verifyingMsg);
      child.eval(` +
		"`" +
		`
        window.s = (key) => ({ turnstile_feedback_report: "Stuck?", turnstile_feedback_description: "Troubleshoot" })[key] || key;
        window.dh = (id) => document.getElementById(id);
        window.__renderHelperLoop = () => {
          if (!window._cf_chl_opt.ZAvY1) return;
          const W = document.createElement("div");
          W.id = "fr-helper-loop-wrapper";
          W.classList.add("error-message-sm");
          const T = document.createElement("span");
          T.id = "fr-helper-loop";
          T.className = "fr-helper-loop";
          T.textContent = window.s("turnstile_feedback_report");
          const f = document.createElement("a");
          f.href = "#refresh";
          f.textContent = window.s("turnstile_feedback_description");
          W.appendChild(T);
          W.appendChild(f);
          W.addEventListener("click", () => window.parent.postMessage({ source: "cloudflare-challenge", widgetId: window._cf_chl_opt.xpbnF3, rayId: window._cf_chl_opt.puyP7, feedbackOrigin: "verifying", event: "feedbackInit" }, "*"));
          window.dh("verifying-msg").appendChild(W);
        };
      ` +
		"`" +
		`);

      const messagePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timed out waiting for feedbackInit")), 3000);
        function onMessage(event) {
          if (event.source !== child || event.data?.widgetId !== widgetId || event.data?.event !== "feedbackInit") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          resolve({ data: event.data, sourceMatchesIframe: event.source === child });
        }
        window.addEventListener("message", onMessage);
      });
      child.__renderHelperLoop();
      child.document.getElementById("fr-helper-loop-wrapper").click();
      const message = await messagePromise;

      const wrapper = child.document.getElementById("fr-helper-loop-wrapper");
      const observed = { wrapperClass: wrapper.className, text: wrapper.textContent, linkHref: wrapper.querySelector("a").getAttribute("href"), message: message.data, sourceMatchesIframe: message.sourceMatchesIframe };
      assert(message.data.feedbackOrigin === "verifying", "helper loop click should report verifying origin");
      assert(message.sourceMatchesIframe === true, "feedbackInit should be posted from iframe realm");
      assertConsistent("inner-helper-loop-feedback-dom", observed);
    } finally {
      iframe.remove();
    }
  `,
});

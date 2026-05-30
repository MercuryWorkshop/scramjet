import { basicTest } from "../../testcommon.ts";

// Strict focused port from payload2_lifted.js:27051-27129 and 27185-27229:
//   if trustedTypes exists, read/createPolicy and try createPolicy("default", {
//     createHTML, createScript, createScriptURL }); create a hidden 0x0 iframe,
//   append it, prefer contentDocument otherwise contentWindow.document, then read
//   contentWindow.trustedTypes. Surrounding contiguous functions also create a div
//   with innerHTML "<b>t</b>" and a script with src "data:,0".

export default basicTest({
	name: "cf-trustedtypes-hidden-iframe-default-policy",
	js: `
    const container = document.createElement("div");
    document.body.appendChild(container);

    try {
      const observations = {
        topHasTrustedTypes: !!window.trustedTypes,
        topCreatePolicyType: window.trustedTypes ? typeof window.trustedTypes.createPolicy : undefined,
        defaultPolicy: null,
        iframe: null,
        innerHTML: null,
        scriptSrc: null,
      };

      if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
          const policy = window.trustedTypes.createPolicy("default", {
            createHTML(value) { return value; },
            createScript(value) { return value; },
            createScriptURL(value) { return value; },
          });
          observations.defaultPolicy = {
            ok: true,
            name: policy && policy.name,
            createHTMLType: policy ? typeof policy.createHTML : undefined,
            createScriptType: policy ? typeof policy.createScript : undefined,
            createScriptURLType: policy ? typeof policy.createScriptURL : undefined,
          };
        } catch (error) {
          observations.defaultPolicy = {
            ok: false,
            name: error && error.name,
            message: error && error.message,
          };
        }
      }

      const iframe = document.createElement("iframe");
      iframe.height = 0;
      iframe.width = 0;
      iframe.style.display = "none";
      container.appendChild(iframe);

      const iframeDocument = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      const iframeWindow = iframe.contentWindow;
      observations.iframe = {
        height: iframe.height,
        width: iframe.width,
        display: iframe.style.display,
        containerContains: container.contains(iframe),
        hasContentDocument: !!iframe.contentDocument,
        fallbackDocumentMatches: !!iframeWindow && iframeDocument === iframeWindow.document,
        contentWindowTrustedTypesType: iframeWindow ? typeof iframeWindow.trustedTypes : undefined,
      };

      const div = document.createElement("div");
      div.innerHTML = "<b>t</b>";
      observations.innerHTML = div.innerHTML;

      const script = document.createElement("script");
      script.src = "data:,0";
      observations.scriptSrc = script.getAttribute("src");

      assert(observations.iframe.containerContains === true, "hidden iframe append mismatch");
      assert(observations.iframe.display === "none", "hidden iframe display mismatch");
      assert(observations.innerHTML === "<b>t</b>", "trustedTypes div innerHTML mismatch");
      assert(observations.scriptSrc === "data:,0", "trustedTypes script src attribute mismatch");
      assertConsistent("trustedtypes-hidden-iframe-default-policy", observations);
    } finally {
      container.remove();
    }
  `,
});

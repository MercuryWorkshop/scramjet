import { basicTest } from "../../testcommon.ts";

// Exact same-origin iframe environment reads from payload2_lifted.js:1636-1682,
// alternate path at 1790-1807, and cleanup at 1768-1786:
//
//   1. document.createElement("iframe")
//   2. iframe.style = "display: none"
//   3. iframe.tabIndex = "-1"
//   4. append to window._cf_chl_opt.kobE3
//   5. read iframe.contentWindow.clientInformation || iframe.contentWindow.navigator
//   6. read iframe.contentDocument
//   7. read iframe.contentWindow.screen
//   8. read iframe.contentWindow.screen.orientation
//   9. performance.getEntriesByType("navigation")
//   10. remove iframe

export default basicTest({
	name: "cf-foreign-iframe-environment-collection",
	js: `
    const iframe = document.createElement("iframe");
    const container = window._cf_chl_opt && window._cf_chl_opt.kobE3
      ? window._cf_chl_opt.kobE3
      : document.body;

    let wasConnectedAfterRemove = null;
    try {
      iframe.style = "display: none";
      iframe.tabIndex = "-1";
      container.appendChild(iframe);

      const cw = iframe.contentWindow;
      assert(cw !== null, "iframe.contentWindow should exist");
      const foreignNavigator = cw.clientInformation || cw.navigator;
      const foreignDocument = iframe.contentDocument;
      const foreignScreen = cw.screen;
      const foreignOrientation = foreignScreen && foreignScreen.orientation;
      const navigationEntries = performance.getEntriesByType("navigation");

      assert(foreignNavigator !== undefined && foreignNavigator !== null,
        "foreign navigator/clientInformation should exist");
      assert(foreignDocument !== null,
        "iframe.contentDocument should exist");
      assert(foreignScreen !== undefined && foreignScreen !== null,
        "foreign screen should exist");
      assert(Array.isArray(navigationEntries),
        "performance.getEntriesByType('navigation') should return an array");

      assertConsistent("foreign-iframe-environment-collection", {
        appendTargetWasKobE3: !!(window._cf_chl_opt && window._cf_chl_opt.kobE3),
        navigatorSameAsMain: foreignNavigator === navigator,
        documentSameAsMain: foreignDocument === document,
        screenSameAsMain: foreignScreen === screen,
        orientationType: typeof foreignOrientation,
        navigationEntryCount: navigationEntries.length,
      });
    } finally {
      iframe.remove();
      wasConnectedAfterRemove = iframe.isConnected;
    }

    assert(wasConnectedAfterRemove === false,
      "iframe should be removed during cleanup");
  `,
});

import { basicTest } from "../../testcommon.ts";

// Ported from data4/payload2_lifted.js:1636-1683 and 1790-1808.
//
// The lifted flow creates a hidden iframe in _cf_chl_opt.kobE3, initializes the
// child realm, then probes contentWindow.clientInformation/navigator,
// contentDocument, contentWindow.screen, screen.orientation, and
// performance.getEntriesByType("navigation").

export default basicTest({
	name: "cf-iframe-realm-probe",
	js: `
		const previousCfOpt = window._cf_chl_opt;
		const container = document.createElement("div");
		document.body.appendChild(container);
		window._cf_chl_opt = Object.assign({}, previousCfOpt, { kobE3: container });

		const iframe = document.createElement("iframe");
		iframe.style = "display: none";
		iframe.tabIndex = -1;
		window._cf_chl_opt.kobE3.appendChild(iframe);

		try {
			const cw = iframe.contentWindow;
			assert(cw !== null, "contentWindow should exist");

			const navigatorLike = cw.clientInformation || cw.navigator;
			assert(navigatorLike !== undefined, "iframe should expose clientInformation or navigator");

			const navEntries = performance.getEntriesByType("navigation");
			const firstNav = navEntries[0];
			const snapshot = {
				clientInformationType: typeof cw.clientInformation,
				navigatorType: typeof cw.navigator,
				clientInformationEqualsNavigator: cw.clientInformation === cw.navigator,
				contentDocumentType: typeof iframe.contentDocument,
				screenType: typeof cw.screen,
				screenWidthType: typeof cw.screen.width,
				screenHeightType: typeof cw.screen.height,
				screenOrientationType: typeof cw.screen.orientation,
				screenOrientationAngleType: cw.screen.orientation ? typeof cw.screen.orientation.angle : "missing",
				performanceEntriesIsArray: Array.isArray(navEntries),
				firstNavigationShape: firstNav ? {
					decodedBodySize: typeof firstNav.decodedBodySize,
					encodedBodySize: typeof firstNav.encodedBodySize,
					serverTimingIsArray: Array.isArray(firstNav.serverTiming),
				} : null,
			};

			assert(snapshot.screenType === "object", "iframe screen should be an object");
			assert(snapshot.screenWidthType === "number", "iframe screen.width should be a number");
			assert(snapshot.performanceEntriesIsArray === true,
				"performance.getEntriesByType('navigation') should return an array");
			assertConsistent("iframe-realm-probe", snapshot);
		} finally {
			iframe.remove();
			document.body.removeChild(container);
			if (previousCfOpt === undefined) delete window._cf_chl_opt;
			else window._cf_chl_opt = previousCfOpt;
		}
	`,
});

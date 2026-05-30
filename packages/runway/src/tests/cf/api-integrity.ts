import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted property probes:
//
// payload2_lifted.js:18413: XMLHttpRequest constructor access
// payload2_lifted.js:20565: Navigator.prototype.sendBeacon
// payload2_lifted.js:20621: NavigatorUAData.prototype.getHighEntropyValues
// payload2_lifted.js:20937: HTMLCanvasElement.prototype.toDataURL
// payload2_lifted.js:21227: window.eval
// payload2_lifted.js:22799: CanvasRenderingContext2D.prototype.getImageData
// payload2_lifted.js:23318: CanvasRenderingContext2D.prototype.fillText
//
// The lifted bodies visibly read these properties. More detailed call/fingerprint
// behavior lives in the dedicated canvas, eval, crypto, and UAData tests.

export default basicTest({
	name: "cf-api-integrity",
	js: `
		assert(typeof window.eval === "function",
			"window eval should be a function");

		assert(typeof XMLHttpRequest === "function",
			"XMLHttpRequest should be a constructor function");
		assert(typeof XMLHttpRequest.prototype.send === "function",
			"XMLHttpRequest.prototype.send should be a function");

		assert(typeof Navigator.prototype.sendBeacon === "function",
			"Navigator.prototype.sendBeacon should be a function");

		assert(typeof NavigatorUAData === "undefined" ||
			typeof NavigatorUAData.prototype.getHighEntropyValues === "function",
			"NavigatorUAData.prototype.getHighEntropyValues should be a function when NavigatorUAData exists");

		assert(typeof HTMLCanvasElement.prototype.toDataURL === "function",
			"HTMLCanvasElement.prototype.toDataURL should be a function");
		assert(typeof CanvasRenderingContext2D.prototype.getImageData === "function",
			"CanvasRenderingContext2D.getImageData should be a function");
		assert(typeof CanvasRenderingContext2D.prototype.fillText === "function",
			"CanvasRenderingContext2D.fillText should be a function");

		assertConsistent("api-integrity-method-shape", {
			eval: typeof eval,
			xhrSend: typeof XMLHttpRequest.prototype.send,
			sendBeacon: typeof Navigator.prototype.sendBeacon,
			toDataURL: typeof HTMLCanvasElement.prototype.toDataURL,
			getImageData: typeof CanvasRenderingContext2D.prototype.getImageData,
			fillText: typeof CanvasRenderingContext2D.prototype.fillText,
		});
	`,
});

import { basicTest } from "../../testcommon.ts";

// Ported from data4 lifted attestation probes:
//
// inner.vm_lifted.js:528-597
//   Date.now() is called, eval.toString() is read, and later branches perform
//   direct window.eval / window.Date presence probes.
//
// payload2_lifted.js:18482-18507
//   Crypto.prototype.getRandomValues and Date.prototype.getTimezoneOffset are
//   read and their typeof values are fed into the hash/check collector.

export default basicTest({
	name: "cf-eval-date-prototype-checks",
	js: `
		const evalSource = window.eval.toString();
		const dateNowValue = Date.now();
		const shape = {
			evalType: typeof window.eval,
			evalToStringType: typeof evalSource,
			evalToStringEmpty: !evalSource,
			dateType: typeof window.Date,
			dateNowType: typeof dateNowValue,
			dateNowFinite: Number.isFinite(dateNowValue),
			cryptoPrototypeGetRandomValues: typeof Crypto.prototype.getRandomValues,
			datePrototypeGetTimezoneOffset: typeof Date.prototype.getTimezoneOffset,
		};

		assert(shape.evalType === "function", "window.eval should be a function");
		assert(shape.evalToStringType === "string", "eval.toString() should return a string");
		assert(shape.evalToStringEmpty === false, "eval.toString() should be non-empty");
		assert(shape.dateType === "function", "window.Date should be a function");
		assert(shape.dateNowType === "number", "Date.now() should return a number");
		assert(shape.dateNowFinite === true, "Date.now() should return a finite number");
		assert(shape.cryptoPrototypeGetRandomValues === "function",
			"Crypto.prototype.getRandomValues should be a function");
		assert(shape.datePrototypeGetTimezoneOffset === "function",
			"Date.prototype.getTimezoneOffset should be a function");

		assertConsistent("eval-date-prototype-shape", shape);
	`,
});

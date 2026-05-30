import { basicTest } from "../../testcommon.ts";

// Adapted from VM function p2_func_181177_17 (lines 6290-6317):
//
//  1. push("qBvg")                              // trace marker
//  2. err = new Error()                          // create Error
//  3. Object.defineProperty(err, "name", {
//       get: handler,
//       configurable: handler,    // FUNC ref, not boolean!
//       enumerable: handler       // FUNC ref, not boolean!
//     })
//  4. Object.defineProperty(err, "message", {    // same pattern
//       get: handler2,
//       configurable: handler2,
//       enumerable: handler2
//     })
//  5. Object.defineProperty(err, "stack", {      // same pattern
//       get: handler3,
//       configurable: handler3,
//       enumerable: handler3
//     })
//
// Critically, Turnstile passes FUNCTION REFERENCES as configurable/enumerable
// values, NOT booleans. This tests:
//   - Can we redefine Error name/message/stack?
//   - Does Object.defineProperty coerce non-boolean configurable/enumerable?
//
// p2_func_186248_83 (lines 5621-5658):
//   After catching the modified Error, Turnstile pushes:
//   - error.name → result
//   - error.message → result
//   - error.stack → result
//   - SDGM5.toString() → result (function source)
//   - (0).id → result
//   - arg.gtQlR0 → result
//   Then calls console.groupEnd()

export default basicTest({
	name: "cf-error-redefine",
	js: `
    // Step 1: trace (simulated)
    const trace = ["qBvg"];

    // Step 2: create Error
    const err = new Error();

    // Step 3-5: redefine Error name/message/stack with FUNCTION refs as booleans
    // (Turnstile uses function references which coerce to true)
    const getterName = function() { return "CaughtError"; };
    const getterMsg  = function() { return "caught: " + trace[0]; };
    const getterStack = function() { return "Trace: " + trace[0]; };

    // Use function as configurable/enumerable — coerces to true
    Object.defineProperty(err, "name", {
      get: getterName,
      configurable: getterName,  // function ref → boolean true
      enumerable: getterName,
    });
    Object.defineProperty(err, "message", {
      get: getterMsg,
      configurable: getterMsg,
      enumerable: getterMsg,
    });
    Object.defineProperty(err, "stack", {
      get: getterStack,
      configurable: getterStack,
      enumerable: getterStack,
    });

    // After redefinition, accessors should return custom values
    assert(err.name === "CaughtError",
      "Error.name after defineProperty should return custom value, got: " + err.name);
    assert(err.message === "caught: qBvg",
      "Error.message after defineProperty should return custom value, got: " + err.message);
    assert(err.stack === "Trace: qBvg",
      "Error.stack after defineProperty should return custom value, got: " + err.stack);

    // Verify configurable/enumerable were coerced to true
    const nameDesc = Object.getOwnPropertyDescriptor(err, "name");
    assert(nameDesc.configurable === true,
      "configurable with function ref should coerce to true, got: " + nameDesc.configurable);
    assert(nameDesc.enumerable === true,
      "enumerable with function ref should coerce to true, got: " + nameDesc.enumerable);

    // Turnstile also checks delete-ability via Object.defineProperty reset
    delete err.name;
    delete err.message;
    delete err.stack;
    assert(err.name === "Error" || err.name === undefined,
      "Error.name after delete should reset");

    // Turnstile collects these values for fingerprinting
    const err2 = new Error("collect test");
    assert(typeof err2.name === "string",
      "Error.name is string for collection: " + err2.name);
    assert(typeof err2.message === "string",
      "Error.message for collection: " + err2.message);
    assert(typeof err2.stack === "string",
      "Error.stack for collection");

    // console.groupEnd() is called after error collection
    try { console.groupEnd(); } catch (_) {}
  `,
});

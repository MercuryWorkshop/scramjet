import { basicTest } from "../../testcommon.ts";

// Exact control flow from payload2_lifted.js:7164-7224:
//
//   1. stack_85 = true
//   2. read navigator.connection
//   3. if navigator.connection && navigator.connection.effectiveType:
//        lMyGu8 = navigator.connection.effectiveType
//      else:
//        lMyGu8 = "unknown"
//   4. read navigator.onLine
//   5. store String(navigator.onLine) as qaiO1 on the truthy typeof path

export default basicTest({
	name: "cf-navigator-connection-online",
	js: `
    const connection = navigator.connection;
    const effectiveTypeOrUnknown = connection && connection.effectiveType
      ? connection.effectiveType
      : "unknown";
    const onLineValue = navigator.onLine;
    const onLineString = String(onLineValue);

    assert(typeof effectiveTypeOrUnknown === "string",
      "effectiveType fallback should be a string, got: " + typeof effectiveTypeOrUnknown);
    assert(onLineString === "true" || onLineString === "false",
      "String(navigator.onLine) should be true/false, got: " + onLineString);

    assertConsistent("navigator-connection-online", {
      connectionType: typeof connection,
      effectiveTypeOrUnknown,
      onLineType: typeof onLineValue,
      onLineString,
    });
  `,
});

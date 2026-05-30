import { basicTest } from "../../testcommon.ts";

// Direct port of the debug breadcrumb cap from data4/inner.js_translated.js:812-824.
//
//   b.DbGvg5 = [];
//   b.cOVIw7 = 30;
//   b.sTuu5 = function(q) {
//     b.DbGvg5.length < b.cOVIw7 && b.DbGvg5.push(q);
//   };

export default basicTest({
	name: "cf-inner-breadcrumb-stack-limit",
	js: `
    const DbGvg5 = [];
    const cOVIw7 = 30;
    function sTuu5(q) {
      DbGvg5.length < cOVIw7 && DbGvg5.push(q);
    }

    for (let i = 0; i < 35; i++) sTuu5("crumb-" + i);

    const observed = {
      length: DbGvg5.length,
      first: DbGvg5[0],
      last: DbGvg5.at(-1),
      hasOverflowCrumb: DbGvg5.includes("crumb-30"),
    };

    assert(observed.length === 30, "breadcrumb stack should cap at 30 entries");
    assert(observed.last === "crumb-29", "overflow entries should be ignored");
    assertConsistent("inner-breadcrumb-stack-limit", observed);
  `,
});

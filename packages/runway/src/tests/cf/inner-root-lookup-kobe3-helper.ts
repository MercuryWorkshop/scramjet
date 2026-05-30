import { basicTest } from "../../testcommon.ts";

// Ports d4() root lookup from data4/inner.js_translated.js:6675-6680.

export default basicTest({
	name: "cf-inner-root-lookup-kobe3-helper",
	js: `
    const root = document.createElement("div");
    const child = document.createElement("div");
    child.id = "GZIfP3";
    root.appendChild(child);
    const opt = { kobE3: root };
    function d4() { return opt.kobE3.querySelector("#GZIfP3"); }
    const observed = { sameChild: d4() === child, id: d4().id, parentMatches: d4().parentElement === root };
    assert(observed.sameChild === true, "d4 should return #GZIfP3 inside _cf_chl_opt.kobE3");
    assertConsistent("inner-root-lookup-kobe3-helper", observed);
  `,
});

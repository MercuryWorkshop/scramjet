import { basicTest } from "../../testcommon.ts";

// Exact environment/eval collection from payload2_lifted.js:22337-22364
// (duplicate non-branch copy at 21874-21900):
//
//   Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "plugins")
//   descriptor.get.toString() -> JSON.stringify(...) -> charCodeAt(2)
//   eval(zjVu3("typeof module"))
//   eval(zjVu3("typeof global"))
//
// Adjacent same chain continues at payload2_lifted.js:21933-21943 / 22290-22311
// with eval("typeof pyimport") and a strict-this expression.

export default basicTest({
	name: "cf-eval-node-globals-and-plugins-getter",
	js: `
    const navigatorProto = Object.getPrototypeOf(navigator);
    const pluginsDescriptor = Object.getOwnPropertyDescriptor(navigatorProto, "plugins");
    const pluginsGetterString = pluginsDescriptor && pluginsDescriptor.get
      ? pluginsDescriptor.get.toString()
      : "";
    const pluginsGetterJson = JSON.stringify(pluginsGetterString);
    const pluginsGetterCharCodeAt2 = ("" + pluginsGetterJson).charCodeAt(2);

    const observed = {
      pluginsGetterCharCodeAt2,
      pluginsGetterPrefix: pluginsGetterString.slice(0, 32),
      typeofModule: eval("typeof module"),
      typeofGlobal: eval("typeof global"),
      typeofPyimport: eval("typeof pyimport"),
      strictThisInequality: eval("(function(){return this}.call(1)) !== (function(){return this}.call(1))"),
    };

    assert(typeof pluginsDescriptor === "object" && pluginsDescriptor !== null,
      "navigator plugins descriptor should exist");
    assert(typeof pluginsDescriptor.get === "function",
      "navigator plugins descriptor getter should be a function");
    assert(observed.typeofModule === "undefined",
      "eval('typeof module') should be undefined, got: " + observed.typeofModule);
    assert(observed.typeofGlobal === "undefined",
      "eval('typeof global') should be undefined, got: " + observed.typeofGlobal);
    assert(observed.typeofPyimport === "undefined",
      "eval('typeof pyimport') should be undefined, got: " + observed.typeofPyimport);

    assertConsistent("eval-node-globals-and-plugins-getter", observed);
  `,
});

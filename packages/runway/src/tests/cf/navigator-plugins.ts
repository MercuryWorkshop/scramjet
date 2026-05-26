import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_146430_27 (line 9065-9072):
//   1. window.navigator.plugins → access plugins
//   2. if plugins is truthy → p2_func_146483_3
//   3. else → p2_func_146544_85 (check other conditions)
//
// p2_func_146483_3 (line 9088-9098):
//   1. window.navigator.plugins.length > 0 → check if plugins exist
//   2. if true → return to chain
//   3. else → set flag "2" → continue
//
// p2_func_146544_85 (line 9074-9078):
//   1. if reg_17 (some other condition) → p2_func_146576_241
//   2. else → set kVPf1 = "2"
//
// Turnstile checks if navigator.plugins exists, has length > 0,
// and the plugins themselves have name/filename/description properties.

export default basicTest({
  name: "cf-navigator-plugins",
  js: `
    // Check 1: navigator.plugins must exist (p2_func_146430_27)
    const plugins = navigator.plugins;
    assert(plugins !== undefined && plugins !== null,
      "navigator.plugins should exist");

    // Check 2: plugins.length must be a number
    assert(typeof plugins.length === "number",
      "navigator.plugins.length should be a number");

    // Check 3: plugins is iterable (it's a PluginArray)
    if (plugins.length > 0) {
      const first = plugins[0];
      assert(first !== undefined,
        "plugins[0] should exist when length > 0");
      assert(typeof first.name === "string",
        "plugin.name should be a string");
      assert(typeof first.filename === "string",
        "plugin.filename should be a string");
      assert(typeof first.description === "string",
        "plugin.description should be a string");
    }

    // Check 4: navigator.mimeTypes must exist
    const mimeTypes = navigator.mimeTypes;
    assert(mimeTypes !== undefined && mimeTypes !== null,
      "navigator.mimeTypes should exist");
    assert(typeof mimeTypes.length === "number",
      "navigator.mimeTypes.length should be a number");

    // Check 5: mimeType entries have type/suffixes
    if (mimeTypes.length > 0) {
      const first = mimeTypes[0];
      assert(typeof first.type === "string",
        "mimeType.type should be a string");
      assert(typeof first.suffixes === "string",
        "mimeType.suffixes should be a string");
      assert(typeof first.description === "string",
        "mimeType.description should be a string");
    }

    // Check 6: Object.getPrototypeOf(navigator).plugins descriptor
    const navProto = Object.getPrototypeOf(navigator);
    const pluginsDesc = Object.getOwnPropertyDescriptor(navProto, "plugins");
    assert(pluginsDesc !== undefined,
      "Navigator prototype should have plugins descriptor");
    if (pluginsDesc && pluginsDesc.get) {
      assert(typeof pluginsDesc.get === "function",
        "plugins getter should be a function");
      assert(pluginsDesc.get.toString().indexOf("get plugins") !== -1,
        "plugins getter should toString as 'get plugins'");
    }
  `,
});
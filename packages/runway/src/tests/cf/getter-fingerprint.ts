import { basicTest } from "../../testcommon.ts";

// Exact control flow from VM functions:
//
// p2_func_68127_87 (lines 20774-20807) + p2_func_68119_195 (lines 20820-20854):
//
//  1. navProto = Object.getPrototypeOf(navigator)
//  2. pluginsDesc = Object.getOwnPropertyDescriptor(navProto, "plugins")
//  3. pluginsGetter = pluginsDesc.get
//  4. getterStr = pluginsGetter.toString()      // native getter source
//  5. jsonStr = JSON.stringify(getterStr)       // JSON-encoded string
//  6. simpleStr = ("" + jsonStr)                 // string coercion
//  7. charCode2 = simpleStr.charCodeAt(2)       // 3rd char byte value
//  8. eval(zjVu3("typeof module"))               // "undefined" check
//  9. eval(zjVu3("typeof global"))               // "undefined" check
//
// Then the same for another navigator getter.
//
// This extracts a numeric byte from the getter's toString representation
// as a fingerprinting value.
//
// p2_func_86159_111 (lines 19044-19056) — Function property enumeration:
//  1. props = Object.getOwnPropertyNames(SDGM5Func)
//  2. sorted = props.sort()
//  3. str = sorted.toString()                   // comma-joined names
//  4. branch based on toString length/truthiness

export default basicTest({
	name: "cf-getter-fingerprint",
	js: `
    // --- p2_func_68127_87: navigator plugins getter fingerprint ---

    // Step 1: getPrototypeOf(navigator)
    const navProto = Object.getPrototypeOf(navigator);
    assert(navProto !== null,
      "navigator prototype should not be null");

    // Step 2: getOwnPropertyDescriptor for "plugins"
    const pluginsDesc = Object.getOwnPropertyDescriptor(navProto, "plugins");
    assert(pluginsDesc !== undefined,
      "navigator prototype should have plugins descriptor");

    // Step 3: get the getter
    const pluginsGetter = pluginsDesc.get;
    assert(typeof pluginsGetter === "function",
      "plugins getter should be a function");

    // Step 4: getter.toString()
    const getterStr = pluginsGetter.toString();
    assert(typeof getterStr === "string",
      "plugins getter toString should be string");
    assert(getterStr.indexOf("get plugins") !== -1,
      "plugins getter should toString as 'get plugins', got: " + getterStr.substring(0, 60));

    // Step 5: JSON.stringify(getter.toString())
    const jsonStr = JSON.stringify(getterStr);
    assert(typeof jsonStr === "string",
      "JSON.stringify(getterStr) should be string");
    assert(jsonStr.length >= 3,
      "JSON string should have at least 3 chars (quotes + 1 char), got: " + jsonStr.length);

    // Step 6: string coercion ("" + jsonStr)
    const simpleStr = "" + jsonStr;
    assert(typeof simpleStr === "string",
      "(''+jsonStr) should be string");

    // Step 7: charCodeAt(2) — Turnstile gets a specific byte
    const charCode = simpleStr.charCodeAt(2);
    assert(typeof charCode === "number",
      "jsonStr.charCodeAt(2) should be a number, got: " + charCode);
    assert(charCode >= 0 && charCode <= 65535,
      "charCode should be 0-65535, got: " + charCode);

    // Repeat for "mimeTypes" — Turnstile fingerprints both
    const mimeDesc = Object.getOwnPropertyDescriptor(navProto, "mimeTypes");
    if (mimeDesc && mimeDesc.get) {
      const mimeStr = mimeDesc.get.toString();
      assert(mimeStr.indexOf("get mimeTypes") !== -1,
        "mimeTypes getter should toString as 'get mimeTypes'");
      const mimeJson = JSON.stringify(mimeStr);
      assert(typeof mimeJson.charCodeAt(2) === "number",
        "mimeTypes getter charCodeAt should be number");
    }

    // --- p2_func_86159_111: Function property enumeration ---
    // Step 1: getOwnPropertyNames
    const fn = Array.prototype.push;
    const props = Object.getOwnPropertyNames(fn);
    assert(Array.isArray(props),
      "getOwnPropertyNames should return array");

    // Step 2: sort
    const sorted = props.sort();
    assert(sorted === props, // sort returns the same array
      "sort should return the sorted array");

    // Step 3: toString (comma-joined)
    const propStr = sorted.toString();
    assert(typeof propStr === "string",
      "sorted properties toString should be string");
    // E.g. "length,name" for Array.prototype.push
    assert(propStr.indexOf("length") !== -1,
      "toString should contain 'length', got: " + propStr);
  `,
});

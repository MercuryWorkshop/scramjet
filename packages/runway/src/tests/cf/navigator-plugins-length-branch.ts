import { basicTest } from "../../testcommon.ts";

// Exact control flow from payload2_lifted.js:9111-9143:
//
//   1. read window.navigator.plugins
//   2. if plugins is falsy or plugins.length <= 0:
//        kVPf1 = "2"
//   3. if plugins.length > 0, branch away without assigning kVPf1

export default basicTest({
	name: "cf-navigator-plugins-length-branch",
	js: `
    const plugins = window.navigator.plugins;
    let kVPf1;
    if (!plugins || plugins.length <= 0) kVPf1 = "2";

    if (!plugins || plugins.length <= 0) {
      assert(kVPf1 === "2",
        "empty plugins fallback should set kVPf1 to literal '2'");
    } else {
      assert(kVPf1 === undefined,
        "non-empty plugins branch should not set kVPf1 fallback");
    }

    assertConsistent("navigator-plugins-length-branch", {
      pluginsType: typeof plugins,
      pluginsLength: plugins ? plugins.length : null,
      kVPf1Set: kVPf1 === "2",
      kVPf1,
    });
  `,
});

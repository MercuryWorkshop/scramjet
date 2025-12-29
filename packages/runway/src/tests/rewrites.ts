import { basicTest } from "../testcommon.ts";

export default [
	// ===========================================
	// UNSAFE_GLOBALS: top, parent, location, eval
	// ===========================================

	// should not be able to get a reference to any of them

	basicTest({
		name: "rewriter-globals-global",
		js: `
        checkglobal(top);
        checkglobal(parent);
        checkglobal(location);
        checkglobal(eval);
    `,
	}),
	basicTest({
		name: "rewriter-globals-global-shadowed",
		js: `
        {
          const top = 123;
          const parent = 456;
          const location = 789;
          checkglobal(top);
          checkglobal(parent);
          checkglobal(location);
          assert(top === 123, "shadowed top changed");
          assert(parent === 456, "shadowed parent changed");
          assert(location === 789, "shadowed location changed");
        }
    `,
	}),

	basicTest({
		name: "rewriter-globals-member",
		js: `
        checkglobal(window.top);
        checkglobal(window.parent);
        checkglobal(window.location);
        checkglobal(window.eval);
    `,
	}),

	basicTest({
		name: "rewriter-computed-member-string",
		js: `
        checkglobal(window["top"]);
        checkglobal(window["parent"]);
        checkglobal(window["location"]);
        checkglobal(window["eval"]);
    `,
	}),

	basicTest({
		name: "rewriter-computed-member-dynamic",
		js: `
        const keys = ["top", "parent", "location", "eval"];
        for (const key of keys) {
          checkglobal(window[key]);
        }
    `,
	}),
];

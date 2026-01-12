import { basicTest } from "../testcommon.ts";
// historical regressions

export default [
	// scramjet/core
	// introduced by: ?
	// fixed by: https://github.com/HeyPuter/browser.js/commit/1715a6aeb072284b58ce38f807f1b14f5151dd7a
	basicTest({
		name: "regression-1715-for-body-walk",
		js: `
            const a = {top: 1, parent: 2, location: 3, eval: 4};
            for (let x in a) {
                checkglobal(window[x]);
            }
            for (let x in a) checkglobal(window[x]);

            const b = ["top", "parent", "location", "eval"];
            for (const x of b) {
                checkglobal(window[x]);
            }
            for (const x of b) checkglobal(window[x]);
    `,
	}),

	// scramjet/core
	// introduced by: ?
	// fixed by: https://github.com/HeyPuter/browser.js/commit/ae35b473dd2cbb0b76d3098e9a748e296cedf425
	basicTest({
		name: "regression-ae35-optional-postmessage",
		js: `
        const messages = [];
        const fakeTarget = {
          postMessage: (msg) => messages.push(msg)
        };
        fakeTarget?.postMessage("test");
        assertEqual(messages.length, 1, "optional postMessage should work");

        const nullTarget = null;
        nullTarget?.postMessage("test");
        assertEqual(messages.length, 1, "null optional should not call");
      `,
	}),

	// scramjet/rewriter
	// tree would be culled if destructure_rewrites was off and a destructure happened
	// introduced by: ?
	// fixed by https://github.com/HeyPuter/browser.js/commit/09f823c9573f9cdd09bc94663a384ace9816fd4c
	// related issue: https://discord.com/channels/1259284248129437726/1457141828557078592
	basicTest({
		name: "regression-09f823c-rewriter-culled",
		js: `
			let [a, b] = (checkglobal(top), [0,1]);
			([b, c] = (checkglobal(top), [0,1]));
			let { d } = (checkglobal(top), ({a: 2}));
			({ d } = (checkglobal(top), ({a:1})));
		`,
	}),

	// scramjet/rewriter
	// crash on overlapping CleanFunction and importfn
	// TODO: this only happens when destructure_rewrites is on. harness does not let you set flags
	// introduced by: ?
	// fixed by https://github.com/HeyPuter/browser.js/commit/09f823c9573f9cdd09bc94663a384ace9816fd4c
	// related issue: https://discord.com/channels/1259284248129437726/1457141828557078592
	basicTest({
		name: "regression-09f823c-rewriter-crash",
		js: `
			()=>import("data:text/javascript,checkglobal(top)")
		`,
	}),
];

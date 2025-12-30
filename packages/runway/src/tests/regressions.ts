import { basicTest } from "../testcommon.ts";
// historical regressions

export default [
	// scramjet
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
];

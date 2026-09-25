import { basicTest } from "../../../testcommon.ts";
/* eslint-disable quotes */

// history traversal between two entries whose URLs differ only in the
// fragment fires hashchange (after popstate) natively
const body = (setup: string) => `
	const ev = [];
	addEventListener("popstate", () => ev.push("pop:" + location.hash));
	addEventListener("hashchange", () => ev.push("hc:" + location.hash));
	${setup}
	await new Promise(r => setTimeout(r, 200));
	ev.length = 0;
	history.back();
	await new Promise(r => setTimeout(r, 500));
	assertEqual(ev.join(","), "pop:#a,hc:#a", "events on back");
`;

export default [
	basicTest({
		name: "rv22-hashtrav-push-push",
		js: body(
			`history.pushState(null, "", "#a"); history.pushState(null, "", "#b");`
		),
	}),
	basicTest({
		name: "rv22-hashtrav-hash-push",
		js: body(
			`location.hash = "a"; await new Promise(r => setTimeout(r, 100)); history.pushState(null, "", "#b");`
		),
	}),
	basicTest({
		name: "rv22-hashtrav-control-hash-hash",
		js: body(
			`location.hash = "a"; await new Promise(r => setTimeout(r, 100)); location.hash = "b";`
		),
	}),
];

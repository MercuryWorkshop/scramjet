import { basicTest } from "../../testcommon.ts";

// Strictly ported from data4/payload2_lifted.js:26985-26996 and repeated
// variants at 26910-26913 / 26966-26969.
//
// The lifted code reads document.location.href, calls
// history.replaceState({}, "", "https://example.org/"), then restores the
// original URL. Capture only that exact call sequence.

export default basicTest({
	name: "cf-history-cross-origin-replace",
	js: `
		const attempt = (label, fn) => {
			try {
				fn();
				return { label, ok: true, href: document.location.href, state: history.state };
			} catch (e) {
				return { label, ok: false, errorName: e.name, href: document.location.href, state: history.state };
			}
		};

		const original = document.location.href;

		const snapshot = {
			original,
			first: attempt("example.org", () => history.replaceState({}, "", "https://example.org/")),
			restore: attempt("restore", () => history.replaceState({}, "", original)),
		};

		assert(snapshot.first.ok === false, "history.replaceState should block cross-origin URLs");
		assert(snapshot.first.errorName === "SecurityError", "history.replaceState should block cross-origin URLs");
		assert(snapshot.restore.ok === true, "history.replaceState should restore the original URL");
		assert(snapshot.restore.href === original, "history.replaceState should restore the original URL");
		assert(snapshot.restore.state === history.state, "history.replaceState should restore the original state");
		console.log(snapshot);
		// assertConsistent("history-cross-origin-replace", snapshot);
	`,
});

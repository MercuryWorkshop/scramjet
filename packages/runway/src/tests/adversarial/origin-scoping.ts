import { basicTest, multiFrameTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// An `about:blank` or `about:srcdoc` document has no origin of its own - it
// inherits its creator's - while its own URL serializes to the opaque "null"
// and has no host at all.
//
// Everything scramjet keys per site therefore has two ways to go wrong, and
// both are asserted here against plain browser truth, so the bare harness is
// the oracle:
//
//   - it splits a namespace that should be shared, because the frame keys on
//     "null" where its creator keys on the real origin
//   - it *joins* namespaces that should be separate, because every about:blank
//     frame on every site keys on that same "null"
//
// The second is the one that matters: it is a cross-site read and write of
// whatever is keyed on it. `bcscope` covers BroadcastChannel; this covers the
// storage areas and the origin a document reports.

const LOAD = `const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 1000); });`;

export default [
	// `self.origin` is the serialization of the document's origin, and an
	// about:blank document's origin is its creator's - not "null".
	basicTest({
		name: "originscope-about-blank-reports-inherited-origin",
		js: `
			${LOAD}
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await load(f);
			assertEqual(
				f.contentWindow.location.href,
				"about:blank",
				"the frame really is about:blank"
			);
			assertEqual(
				f.contentWindow.origin,
				location.origin,
				"an about:blank frame reports its creator's origin"
			);
		`,
	}),

	// Same for a srcdoc frame, which inherits the same way.
	basicTest({
		name: "originscope-srcdoc-reports-inherited-origin",
		js: `
			${LOAD}
			const f = document.createElement("iframe");
			f.srcdoc = "<!DOCTYPE html><p>srcdoc</p>";
			document.body.appendChild(f);
			await load(f);
			assertEqual(
				f.contentWindow.origin,
				location.origin,
				"a srcdoc frame reports its creator's origin"
			);
		`,
	}),

	// Storage is keyed on the origin, so an about:blank frame's storage area is
	// its creator's - the same area, not a copy of it.
	basicTest({
		name: "originscope-about-blank-shares-embedder-storage",
		js: `
			${LOAD}
			const key = "originscope-shared-" + Math.random();
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await load(f);

			f.contentWindow.localStorage.setItem(key, "written-by-the-frame");
			assertEqual(
				localStorage.getItem(key),
				"written-by-the-frame",
				"the embedder reads what its about:blank frame wrote"
			);

			localStorage.setItem(key, "written-by-the-embedder");
			assertEqual(
				f.contentWindow.localStorage.getItem(key),
				"written-by-the-embedder",
				"and the frame reads what the embedder wrote"
			);

			localStorage.removeItem(key);
		`,
	}),

	// The other half, and the one that is a hole rather than a nuisance: two
	// sites' about:blank frames both have *an* inherited origin, and those are
	// not the same one.
	multiFrameTest({
		name: "originscope-about-blank-frames-do-not-share-storage",
		root: {
			js: () => `
				${LOAD}
				// multiFrameTest serves a frame's script raw rather than through
				// runTest, so the async scope and the failure path are explicit
				(async () => {
					const f = document.createElement("iframe");
					document.body.appendChild(f);
					await load(f);

					// written under this site's inherited origin
					f.contentWindow.localStorage.setItem(
						"originscope-xorigin",
						"site-a"
					);

					// long enough for the cross-origin frame to have read it
					await new Promise((r) => setTimeout(r, 900));
					pass();
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "reader",
					js: () => `
						${LOAD}
						(async () => {
							const f = document.createElement("iframe");
							document.body.appendChild(f);
							await load(f);

							// after the root's about:blank frame has written
							await new Promise((r) => setTimeout(r, 500));
							const seen =
								f.contentWindow.localStorage.getItem("originscope-xorigin");
							if (seen !== null) {
								fail(
									"an about:blank frame read another site's about:blank storage: " +
										seen
								);
							}
						})().catch((error) => fail(error && error.message));
					`,
				},
			],
		},
	}),
];

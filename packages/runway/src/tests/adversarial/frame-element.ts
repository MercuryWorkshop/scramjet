import { basicTest, multiFrameTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// `window.frameElement` is the one Window attribute whose whole job is an
// origin comparison, which makes it the shape a proxy is worst at.
//
// https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-frameelement
//
//   1. Let current be this's node navigable.
//   2. If current is null, then return null.
//   3. Let container be current's container.
//   4. If container is null, then return null.
//   5. If container's node document's origin is not same origin-domain with
//      the current settings object's origin, then return null.
//   6. Return container.
//
// Under scramjet every proxied document genuinely *is* same-origin, so step 5
// always passes in the engine and has to be re-made against the origins the
// sites themselves have. Every test below asserts plain browser truth, so the
// bare harness is the oracle: a case the interceptor gets wrong fails in the
// scramjet harness and passes in bare.
//
// The three cases that inherit an origin rather than having one - about:blank,
// about:srcdoc, and either of those nested inside a cross-origin frame - are
// the ones a naive `client.url.origin` comparison breaks, because `client.url`
// for one of those is the literal `about:` URL whose origin serializes to
// "null". They are here to hold the walk in `siteOrigin` in place.

const LOAD = `const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 1000); });`;

export default [
	// --- the container is reachable ---------------------------------------

	// Baseline. Nothing here diverges; it is what a regression in the
	// cross-origin checks below would break first.
	multiFrameTest({
		name: "frameelement-same-origin-child",
		root: {
			js: () => `// this frame only exists to embed the next one`,
			subframes: [
				{
					id: "sameorigin",
					js: () => `
						const container = window.frameElement;
						assert(container, "a same-origin child can see its container");
						assertEqual(container.tagName, "IFRAME", "container is the iframe");
						assertEqual(
							container,
							parent.document.querySelector("iframe"),
							"and it is the same element the embedder holds"
						);
						pass();
					`,
				},
			],
		},
	}),

	// The mirror of frameelement-cross-origin-grandchild-is-null: A -> B -> C
	// where C is on B's origin. C's container lives in B's document, so it is
	// same-origin and must come back. A fix that compared the wrong pair of
	// origins - or that gave up and returned null whenever a cross-origin frame
	// appeared anywhere in the chain - would break here and nowhere else.
	multiFrameTest({
		name: "frameelement-same-origin-grandchild",
		root: {
			js: () => `// this frame only exists to embed the next one`,
			subframes: [
				{
					originid: "cross",
					id: "crossmiddle",
					js: () => `// this frame only exists to embed the next one`,
					subframes: [
						{
							originid: "cross",
							id: "crossleaf",
							js: () => `
								const container = window.frameElement;
								assert(container, "same-origin-to-its-embedder grandchild sees its container");
								assertEqual(
									container,
									parent.document.querySelector("iframe"),
									"container is the iframe in the middle frame"
								);
								pass();
							`,
						},
					],
				},
			],
		},
	}),

	// --- the container is hidden ------------------------------------------

	// THE headline case, and the one the old `Trap` got wrong.
	//
	// Old logic: read the native `frameElement`, and hand it back whenever the
	// container's document belonged to a scramjet-controlled window. Under
	// scramjet the embedder is always scramjet-controlled, and the native
	// always answers with the element because the two documents really are
	// same-origin - so the test above and this one took the same branch. A site
	// embedded cross-origin could tell it was framed where a browser reports
	// nothing, and then reach its embedder's DOM through the element it was
	// handed.
	multiFrameTest({
		name: "frameelement-cross-origin-child-is-null",
		root: {
			js: () => `// this frame only exists to embed the next one`,
			subframes: [
				{
					originid: "cross",
					id: "crosschild",
					js: () => `
						assertEqual(
							window.frameElement,
							null,
							"a cross-origin child must not see its container"
						);
						pass();
					`,
				},
			],
		},
	}),

	// A -> B -> C, where C is back on A's origin. C's container is an iframe in
	// B's document, so C sees an element belonging to a third site.
	//
	// Worse than the case above rather than a variation on it: the old logic
	// handed C a live element in B's document, which is neither C's origin nor
	// its embedder-of-record, so C could read B's DOM without ever having been
	// same-origin with it.
	multiFrameTest({
		name: "frameelement-cross-origin-grandchild-is-null",
		root: {
			js: () => `// this frame only exists to embed the next one`,
			subframes: [
				{
					originid: "cross",
					id: "middle",
					js: () => `// this frame only exists to embed the next one`,
					subframes: [
						{
							originid: "main",
							id: "leaf",
							js: () => `
								assertEqual(
									window.frameElement,
									null,
									"a grandchild must not see a container in a third origin's document"
								);
								pass();
							`,
						},
					],
				},
			],
		},
	}),

	// The proxied document at the top of the harness. Its container is the
	// harness's own iframe, in a document that is not proxied at all - outside
	// the sandbox, so step 5 hides it. Regression cover for the branch that
	// answers null when no client owns the embedder's window.
	basicTest({
		name: "frameelement-top-level-is-null",
		js: `
			assertEqual(
				window.frameElement,
				null,
				"a document whose embedder is outside the sandbox sees no container"
			);
		`,
	}),

	// --- documents that inherit an origin ---------------------------------

	// about:srcdoc has no origin of its own; it inherits its embedder's. Read
	// through the child's own accessor (`f.contentWindow.frameElement` resolves
	// on the child's window), so it is the srcdoc document's client deciding.
	//
	// Passed under the old logic and passes now, but for a different reason,
	// and the new reason is the fragile one: `client.url.href` here is the
	// literal "about:srcdoc" and `client.url.origin` is the string "null", so
	// comparing origins directly would hide a container the browser shows.
	basicTest({
		name: "frameelement-srcdoc-inherits-origin",
		js: `
			${LOAD}
			const f = document.createElement("iframe");
			f.srcdoc = "<!DOCTYPE html><p>srcdoc</p>";
			document.body.appendChild(f);
			await load(f);
			assertEqual(
				f.contentWindow.frameElement,
				f,
				"a srcdoc frame inherits its embedder's origin and sees its container"
			);
		`,
	}),

	// Same, for an iframe with no src at all.
	basicTest({
		name: "frameelement-about-blank-inherits-origin",
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
				f.contentWindow.frameElement,
				f,
				"an about:blank frame inherits its embedder's origin and sees its container"
			);
		`,
	}),

	// The inheritance case one level down, where the origin being inherited is
	// *not* the top document's: A -> B(cross-origin) -> about:blank child of B.
	// The about:blank frame inherits B's origin, its container is in B's
	// document, so the container is visible - while B's own container, in A's
	// document, is not. Both halves are asserted in the same frame because
	// getting one right by hiding or showing everything is the failure mode.
	multiFrameTest({
		name: "frameelement-about-blank-in-cross-origin-frame",
		root: {
			js: () => `// this frame only exists to embed the next one`,
			subframes: [
				{
					originid: "cross",
					id: "crosshost",
					js: () => `
						${LOAD}
						// multiFrameTest serves a frame's script raw rather than
						// through runTest, so the async scope and the failure path
						// have to be spelled out here
						(async () => {
							assertEqual(
								window.frameElement,
								null,
								"the cross-origin frame still cannot see its own container"
							);

							const inner = document.createElement("iframe");
							document.body.appendChild(inner);
							await load(inner);
							assertEqual(
								inner.contentWindow.frameElement,
								inner,
								"its about:blank child inherits *its* origin, not the top document's"
							);
							pass();
						})().catch((error) => fail(error && error.message));
					`,
				},
			],
		},
	}),

	// --- steps 1-4, which stay the native's ------------------------------

	// The spec's own example: removing the iframe discards the browsing
	// context, so there is no navigable and no container.
	basicTest({
		name: "frameelement-detached-is-null",
		js: `
			${LOAD}
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await load(f);
			const w = f.contentWindow;
			assertEqual(w.frameElement, f, "attached, the container is the iframe");
			f.remove();
			assertEqual(
				w.frameElement,
				null,
				"detached, there is no navigable to have a container"
			);
		`,
	}),

	// Differential snapshot of the property itself rather than of its value.
	//
	// `frameElement` is a plain `readonly attribute Element?` - a getter, no
	// setter - and its getter brand-checks its receiver. All three are things an
	// interceptor can quietly change: declaring a setter fabricates one the
	// interface never had, and answering out of client state without touching
	// the receiver turns `get.call({})` into an answer where the browser throws.
	basicTest({
		name: "frameelement-descriptor-shape",
		js: `
			const own = Object.getOwnPropertyDescriptor(window, "frameElement");
			const onProto = Object.getOwnPropertyDescriptor(
				Window.prototype,
				"frameElement"
			);
			const d = own || onProto;
			assert(d, "the attribute exists somewhere");

			let brand;
			try {
				d.get.call({});
				brand = "returned";
			} catch (error) {
				brand = error && error.constructor && error.constructor.name;
			}

			assertConsistent("frameelement-descriptor", {
				// [Global] puts an interface's members on the global object
				// itself, so this is where it should be - and defining a patched
				// member anywhere else leaves a shadowing own property behind
				onWindow: !!own,
				onWindowPrototype: !!onProto,
				getter: typeof d.get,
				setter: typeof d.set,
				enumerable: d.enumerable,
				configurable: d.configurable,
				brandCheck: brand,
			});
		`,
	}),
];

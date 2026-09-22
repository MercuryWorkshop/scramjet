import { basicTest, multiFrameTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// A BroadcastChannel is matched on the tuple (storage key, name), and every
// proxied document shares the one real storage key - so the name is the only
// thing keeping two sites' channels apart, and it has to carry the origin.
//
// https://html.spec.whatwg.org/multipage/web-messaging.html#broadcastchannel
//
// `llm/broadcastchannel.ts` covers the envelope and the delivery semantics.
// This file covers only the scoping: that the prefix is invisible to the page,
// and that it lands on the origin the *site* has rather than the one the
// browser sees.
//
// The about:blank cases are the sharp edge. Such a document has no origin of
// its own - it inherits its creator's - while its own URL serializes to the
// opaque "null". Scoping on `client.url.origin` would therefore file every
// about:blank frame on every site under one shared "null" namespace, which is
// the same cross-site channel one level down. `ScramjetClient.siteOrigin`
// answers with the creator's origin, recorded once when the client was
// constructed, and these hold that in place.

const LOAD = `const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 1000); });`;

export default [
	// The prefix is an implementation detail and must not be observable. An
	// origin cannot contain "@", which is what lets the un-scoping split on the
	// first one and leave a name the page put an "@" in intact.
	basicTest({
		name: "bcscope-name-round-trips",
		js: `
			for (const name of ["plain", "with@at", "@leading", "trailing@", "a@b@c", ""]) {
				const bc = new BroadcastChannel(name);
				assertEqual(bc.name, name, "name round-trips: " + JSON.stringify(name));
				bc.close();
			}

			// and a name that looks like a scoped one must not be un-scoped twice
			const spoof = new BroadcastChannel(location.origin + "@spoof");
			assertEqual(
				spoof.name,
				location.origin + "@spoof",
				"a name that already looks scoped survives"
			);
			spoof.close();
		`,
	}),

	// Two channels of the same name in one document still find each other -
	// the scoping must be a prefix both sides agree on, not a per-instance one.
	basicTest({
		name: "bcscope-same-document-still-connects",
		js: `
			const name = "bcscope-same-doc-" + Math.random();
			const a = new BroadcastChannel(name);
			const b = new BroadcastChannel(name);
			b.addEventListener("message", (event) => {
				assertEqual(event.data, "hello", "the message arrives unwrapped");
				a.close();
				b.close();
				pass();
			});
			a.postMessage("hello");
		`,
		autoPass: false,
	}),

	// An about:blank frame inherits its embedder's origin, so its channels are
	// its embedder's channels. The channel is constructed through the child's
	// own interface object, so it is the child's client doing the scoping.
	basicTest({
		name: "bcscope-about-blank-inherits-embedder",
		js: `
			${LOAD}
			const name = "bcscope-inherit-" + Math.random();
			const mine = new BroadcastChannel(name);
			mine.addEventListener("message", (event) => {
				assertEqual(event.data, "from-about-blank", "the message crossed into the embedder");
				mine.close();
				pass();
			});

			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await load(f);
			const theirs = new f.contentWindow.BroadcastChannel(name);
			theirs.postMessage("from-about-blank");
			theirs.close();
		`,
		autoPass: false,
	}),

	// Inheritance is recorded once per client, from its creator, rather than
	// walked at read time - so a chain of about:blank documents has to resolve
	// through each link's own captured answer. Two deep is enough to tell the
	// two designs apart: the inner frame's creator is itself a document with no
	// origin of its own.
	basicTest({
		name: "bcscope-nested-about-blank-inherits",
		js: `
			${LOAD}
			const name = "bcscope-nested-" + Math.random();
			const mine = new BroadcastChannel(name);
			mine.addEventListener("message", (event) => {
				assertEqual(event.data, "from-two-deep", "the message reached the top document");
				mine.close();
				pass();
			});

			const outer = document.createElement("iframe");
			document.body.appendChild(outer);
			await load(outer);

			const inner = outer.contentDocument.createElement("iframe");
			outer.contentDocument.body.appendChild(inner);
			await load(inner);

			assertEqual(
				inner.contentWindow.location.href,
				"about:blank",
				"the inner frame really is about:blank too"
			);
			const theirs = new inner.contentWindow.BroadcastChannel(name);
			theirs.postMessage("from-two-deep");
			theirs.close();
		`,
		autoPass: false,
	}),

	// The direction `llm/broadcastchannel.ts` doesn't cover: the embedder
	// posts, and the cross-origin child must not hear it.
	multiFrameTest({
		name: "bcscope-cross-origin-child-cannot-receive",
		root: {
			js: () => `
				setTimeout(() => {
					const bc = new BroadcastChannel("bcscope-xorigin-down");
					bc.postMessage("should-not-cross");
					bc.close();
				}, 100);
			`,
			subframes: [
				{
					originid: "cross",
					id: "listener",
					js: () => `
						const bc = new BroadcastChannel("bcscope-xorigin-down");
						let leaked = false;
						bc.addEventListener("message", () => {
							leaked = true;
						});
						setTimeout(() => {
							bc.close();
							if (leaked) {
								fail("a message from another origin reached this frame");
							} else {
								pass();
							}
						}, 600);
					`,
				},
			],
		},
	}),

	// The case the inheritance walk exists for: an about:blank frame inside
	// site A and one inside site B. Neither has an origin of its own, so
	// scoping on their own URLs files both under "null" and reopens exactly the
	// channel this is all meant to close - one level further down, where it is
	// much less likely to be noticed.
	multiFrameTest({
		name: "bcscope-about-blank-frames-do-not-cross-origins",
		root: {
			js: () => `
				${LOAD}
				// multiFrameTest serves a frame's script raw rather than through
				// runTest, so the async scope and the failure path are explicit
				(async () => {
					const f = document.createElement("iframe");
					document.body.appendChild(f);
					await load(f);

					const bc = new f.contentWindow.BroadcastChannel("bcscope-blank-xorigin");
					let leaked = false;
					bc.addEventListener("message", () => {
						leaked = true;
					});

					setTimeout(() => {
						bc.close();
						if (leaked) {
							fail(
								"an about:blank frame heard another site's about:blank frame"
							);
						} else {
							pass();
						}
					}, 900);
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "blanksender",
					js: () => `
						${LOAD}
						(async () => {
							const f = document.createElement("iframe");
							document.body.appendChild(f);
							await load(f);

							// after the root has had time to install its listener
							await new Promise((r) => setTimeout(r, 400));
							const bc = new f.contentWindow.BroadcastChannel(
								"bcscope-blank-xorigin"
							);
							bc.postMessage("should-not-cross");
							bc.close();
						})().catch((error) => fail(error && error.message));
					`,
				},
			],
		},
	}),
];

import { multiFrameTest } from "../../testcommon.ts";

// https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
//
// Step 4: if `targetOrigin` is neither "*" nor "/", it is parsed, and step 8
// aborts the delivery unless the *targetWindow's* origin is same origin with
// it. That check is the only thing standing between a page and sending a
// secret to the wrong frame, and it is the reason `postMessage(token,
// "https://trusted.example")` is the documented safe idiom.
//
// Every proxied document shares one real origin, so the browser's own check
// always passes and cannot be relied on. `shared/postmessage.ts` rewrites
// `targetOrigin` to "*" so the message gets through the envelope wrapping, and
// nothing puts the sender's restriction back - so a message addressed to one
// site is delivered to another.
//
// The bare harness is the oracle: there the two frames are genuinely
// cross-origin, so the browser drops the message by itself.

export default [
	// A message addressed to an origin the receiving frame does not have must
	// not be delivered.
	multiFrameTest({
		name: "pmtarget-mismatched-origin-is-not-delivered",
		root: {
			js: () => `
				(async () => {
					await new Promise((r) => setTimeout(r, 400));

					const frame = document.querySelector("iframe");
					frame.contentWindow.postMessage(
						"PM-TARGET-SECRET",
						"https://pmtarget-not-this-frame.example"
					);
				})().catch((error) => fail(error && error.message));
			`,
			subframes: [
				{
					originid: "cross",
					id: "pmtargetlistener",
					js: () => `
						let leaked = null;
						window.addEventListener("message", (event) => {
							if (event.data === "PM-TARGET-SECRET") leaked = event.origin;
						});
						setTimeout(() => {
							if (leaked === null) {
								pass();
							} else {
								fail(
									"a message addressed to another origin was delivered (event.origin=" +
										leaked +
										")"
								);
							}
						}, 900);
					`,
				},
			],
		},
	}),

	// The positive control: the same send, addressed to the frame's real
	// origin, must still arrive. A fix that simply drops every non-"*"
	// targetOrigin would pass the test above and break this one.
	multiFrameTest({
		name: "pmtarget-matching-origin-is-delivered",
		root: {
			js: () => `
				(async () => {
					await new Promise((r) => setTimeout(r, 400));

					const frame = document.querySelector("iframe");
					// the child's own origin, which it messaged up to us
					frame.contentWindow.postMessage(
						"PM-TARGET-EXPECTED",
						window.__pmtargetChildOrigin || "*"
					);
				})().catch((error) => fail(error && error.message));

				window.addEventListener("message", (event) => {
					if (event.data && event.data.pmtargetOrigin) {
						window.__pmtargetChildOrigin = event.data.pmtargetOrigin;
					}
				});
			`,
			subframes: [
				{
					originid: "cross",
					id: "pmtargetecho",
					js: () => `
						parent.postMessage({ pmtargetOrigin: new URL(document.URL).origin }, "*");

						let got = false;
						window.addEventListener("message", (event) => {
							if (event.data === "PM-TARGET-EXPECTED") got = true;
						});
						setTimeout(() => {
							if (got) {
								pass();
							} else {
								fail("a message addressed to this frame's own origin never arrived");
							}
						}, 900);
					`,
				},
			],
		},
	}),
];

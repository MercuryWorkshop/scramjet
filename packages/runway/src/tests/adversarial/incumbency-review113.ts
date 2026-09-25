import { incumbenceTest } from "../../incumbence.ts";
import {
	basicTest,
	htmlTest,
	multiFrameTest,
	serverTest,
} from "../../testcommon.ts";

// https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
// Invalid target origins throw, and the transfer list is passed to structured serialization.
const invalidTargetOrigin = basicTest({
	name: "review113-postmessage-invalid-target-origin",
	js: `
		let threw = false;
		try { window.postMessage("ignored", "not an origin"); }
		catch (error) { threw = error instanceof DOMException && error.name === "SyntaxError"; }
		assertEqual(threw, true, "an invalid targetOrigin must throw SyntaxError");
	`,
});
invalidTargetOrigin.incumbencyMode = "stamp";

const windowTransfer = basicTest({
	name: "review113-postmessage-transfer-list",
	autoPass: false,
	js: `
		const channel = new MessageChannel();
		window.addEventListener("message", (event) => {
			if (event.data?.tag !== "transferred") return;
			assertEqual(event.data.port instanceof MessagePort, true, "port arrived");
			assertEqual(event.ports.length, 1, "event.ports exposes the transferred port");
			pass();
		}, { once: true });
		window.postMessage({ tag: "transferred", port: channel.port2 }, "*", [channel.port2]);
	`,
});
windowTransfer.incumbencyMode = "stamp";

const windowTransferOptions = basicTest({
	name: "review113-postmessage-transfer-options",
	autoPass: false,
	js: `
		const channel = new MessageChannel();
		window.addEventListener("message", (event) => {
			if (event.data?.tag !== "options-transfer") return;
			assertEqual(event.ports.length, 1, "options.transfer supplies event.ports");
			pass();
		}, { once: true });
		window.postMessage(
			{ tag: "options-transfer", port: channel.port2 },
			{ targetOrigin: "*", transfer: [channel.port2] }
		);
	`,
});
windowTransferOptions.incumbencyMode = "stamp";

// The event origin is the sender's origin, fixed when it posts the message.
const senderOrigin = multiFrameTest({
	name: "review113-messageevent-sender-origin",
	root: {
		js: ({ url }) => `
			window.addEventListener("message", (event) => {
				if (!event.data?.senderOrigin) return;
				if (event.origin === event.data.senderOrigin && event.origin !== ${JSON.stringify(new URL(url).origin)})
					pass();
				else fail("origin=" + event.origin + ", sender=" + event.data.senderOrigin + ", receiver=${new URL(url).origin}");
			});
		`,
		subframes: [
			{
				id: "sender",
				originid: "cross",
				js: ({ url }) =>
					`parent.postMessage({ senderOrigin: ${JSON.stringify(new URL(url).origin)} }, "*");`,
			},
		],
	},
});
senderOrigin.incumbencyMode = "stamp";

// MessagePort and Worker events have an empty origin, including one-argument sends.
// https://html.spec.whatwg.org/multipage/web-messaging.html#dom-messageport-postmessage
const portOneArgument = basicTest({
	name: "review113-messageport-one-argument-origin",
	autoPass: false,
	js: `
		const channel = new MessageChannel();
		channel.port2.onmessage = (event) => {
			assertEqual(event.data, "port-one-arg", "payload arrived");
			assertEqual(event.origin, "", "MessagePort event origin is empty");
			pass();
		};
		channel.port1.postMessage("port-one-arg");
	`,
});

const workerOneArgument = basicTest({
	name: "review113-worker-one-argument-origin",
	autoPass: false,
	js: `
		const source = 'self.onmessage = (event) => postMessage(event.data);';
		const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
		worker.onmessage = (event) => {
			assertEqual(event.data, "worker-one-arg", "payload arrived");
			assertEqual(event.origin, "", "Worker event origin is empty");
			worker.terminate();
			pass();
		};
		worker.postMessage("worker-one-arg");
	`,
});

function boundCallbackTest(mode: "pst" | "stamp" | "lazystamp") {
	return Object.assign(
		incumbenceTest({
			name: `review113-${mode}-host-callback-incumbent`,
			expect: "frame",
			docs: {
				top: `
					function clobber() { console.log("clobber incumbent"); }
					setTimeout(() => {
						if (!window.__reported) fail("bound callback did not deliver a message");
					}, 2500);
					addEventListener("message", (event) => {
						if (event.data === "bound-callback")
							__report(event.source === frames[0] ? "frame" : "top");
					});
				`,
				frame: `
					parent.setTimeout(parent.postMessage.bind(parent, "bound-callback", "*"), 50);
					parent.clobber();
				`,
			},
		}),
		{ incumbencyMode: mode, timeoutMs: 10000 }
	);
}

// A directive remains in the directive prologue after a comment. The injected
// prelude must not put executable code before it.
// https://tc39.es/ecma262/#sec-directive-prologues-and-the-use-strict-directive
const strictAfterComment = Object.assign(
	htmlTest({
		name: "review113-strict-after-leading-comment",
		html: `<!doctype html><html><body><script>
			/* banner */
			"use strict";
			function bareThis() { return this; }
			runTest(async () => {
				assertEqual(bareThis(), undefined, "strict directive lost after leading comment");
			}, true);
		</script></body></html>`,
	}),
	{ incumbencyMode: "pst" as const, timeoutMs: 10000 }
);

const noneArrayPayload = Object.assign(
	basicTest({
		name: "review113-none-array-postmessage",
		autoPass: false,
		js: `
			window.addEventListener("message", (event) => {
				if (Array.isArray(event.data) && event.data[0] === "array-payload") pass();
			}, { once: true });
			window.postMessage(["array-payload"], "*");
		`,
	}),
	{ incumbencyMode: "none" as const, timeoutMs: 10000 }
);

export default [
	invalidTargetOrigin,
	windowTransfer,
	windowTransferOptions,
	senderOrigin,
	portOneArgument,
	workerOneArgument,
	boundCallbackTest("stamp"),
	boundCallbackTest("lazystamp"),
	boundCallbackTest("pst"),
	strictAfterComment,
	noneArrayPayload,
];

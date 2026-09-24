import { basicTest, multiFrameTest, type Test } from "../../testcommon.ts";

// https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
// Run the same observable behavior under both production attribution modes.
let mode: "pst" | "lazystamp";

function windowTest(name: string, js: string, autoPass = true): Test {
	const test = basicTest({ name: `pmatrix-${mode}-${name}`, js, autoPass });
	test.incumbencyMode = mode;
	test.timeoutMs = 5000;
	return test;
}

function crossOriginDelivery(
	name: string,
	send: string,
	expectDelivery: boolean
): Test {
	const test = multiFrameTest({
		name: `pmatrix-${mode}-${name}`,
		root: {
			js: () => `
				addEventListener("message", (event) => {
					if (event.data?.pmatrixReady !== ${JSON.stringify(name)}) return;
					const target = document.querySelector("iframe").contentWindow;
					const childOrigin = event.data.childOrigin;
					try { ${send} target.postMessage({ pmatrixSent: ${JSON.stringify(name)} }, "*"); }
					catch (error) { fail("send threw: " + error.name + ": " + error.message); }
				});
			`,
			subframes: [
				{
					id: `receiver_${name.replaceAll("-", "_")}`,
					originid: `cross_${name.replaceAll("-", "_")}`,
					js: ({ url }) => `
					let settled = false;
					let sent = false;
					addEventListener("message", (event) => {
						if (event.data?.pmatrixSent === ${JSON.stringify(name)}) { sent = true; return; }
						if (event.data !== ${JSON.stringify(`data-${name}`)}) return;
						settled = true;
						${expectDelivery ? "pass();" : 'fail("message crossed a forbidden origin");'}
					});
					parent.postMessage({
						pmatrixReady: ${JSON.stringify(name)},
						childOrigin: ${JSON.stringify(new URL(url).origin)}
					}, "*");
					setTimeout(() => {
						if (!sent) { fail("sender never completed the send"); return; }
						if (!settled) ${expectDelivery ? 'fail("message was not delivered");' : "pass();"}
					}, 800);
				`,
				},
			],
		},
	});
	test.incumbencyMode = mode;
	test.timeoutMs = 5000;
	return test;
}

function cases() {
	// HTML parses this URL successfully and compares its fresh opaque origin.
	// Chromium currently throws SyntaxError instead, so use a spec assertion.
	const opaqueURL = windowTest(
		"opaque-target-url-does-not-match",
		`
		addEventListener("message", e => {
			assertEqual(e.data, "accepted"); pass();
		}, { once: true });
		window.postMessage("rejected", "data:text/plain,opaque");
		window.postMessage("accepted", "*");
	`,
		false
	);
	opaqueURL.scramjetOnly = true;
	return [
		opaqueURL,
		windowTest(
			"sandboxed-opaque-origin",
			`
		const frame = document.createElement("iframe");
		frame.sandbox = "allow-scripts";
		frame.srcdoc = '<script>' + \`
			addEventListener("message", e => {
				if (e.data === "self") parent.postMessage("ready", "*");
				else if (e.data === "forbidden") parent.postMessage("leaked", "*");
				else if (e.data === "finish") parent.postMessage("finished", "*");
			});
			window.postMessage("self", "/");
		\` + '</script>';
		addEventListener("message", e => {
			if (e.source !== frame.contentWindow) return;
			assertEqual(e.origin, "null");
			if (e.data === "ready") {
				frame.contentWindow.postMessage("forbidden", "/");
				frame.contentWindow.postMessage("finish", "*");
			} else if (e.data === "leaked") fail("opaque target matched a different origin");
			else if (e.data === "finished") pass();
		});
		document.body.append(frame);
	`,
			false
		),
		windowTest(
			"srcdoc-inherits-origin",
			`
		const frame = document.createElement("iframe");
		frame.srcdoc = '<script>parent.postMessage("inherited", "/")</script>';
		addEventListener("message", e => {
			if (e.data !== "inherited") return;
			assertEqual(e.source, frame.contentWindow);
			assertEqual(e.origin, new URL(document.URL).origin);
			pass();
		});
		document.body.append(frame);
	`,
			false
		),
		windowTest(
			"blob-inherits-origin",
			`
		const frame = document.createElement("iframe");
		frame.src = URL.createObjectURL(new Blob(['<script>parent.postMessage("blob", "/")</script>'], { type: "text/html" }));
		addEventListener("message", e => {
			if (e.data !== "blob") return;
			assertEqual(e.source, frame.contentWindow);
			assertEqual(e.origin, new URL(document.URL).origin);
			pass();
		});
		document.body.append(frame);
	`,
			false
		),

		windowTest(
			"dictionary-conversion-order",
			`
		const order = [];
		window.postMessage("ignored", {
			get transfer() { order.push("transfer"); return {
				[Symbol.iterator]() { order.push("iterator"); return [][Symbol.iterator](); }
			}; },
			get targetOrigin() { order.push("origin"); return {
				toString() { order.push("string"); return "*"; }
			}; }
		});
		assertDeepEqual(order, ["transfer", "iterator", "origin", "string"]);
	`
		),
		windowTest(
			"dictionary-throw-order",
			`
		const sentinel = {};
		let thrown;
		try { window.postMessage("ignored", {
			get transfer() { throw sentinel; },
			get targetOrigin() { fail("derived member read after inherited member threw"); }
		}); } catch (error) { thrown = error; }
		assertEqual(thrown, sentinel);
	`
		),
		windowTest(
			"three-argument-overload",
			`
		const order = [];
		window.postMessage("ignored", {
			get targetOrigin() { fail("dictionary overload selected for three arguments"); },
			toString() { order.push("string"); return "*"; }
		}, { [Symbol.iterator]() { order.push("iterator"); return [][Symbol.iterator](); } });
		assertDeepEqual(order, ["string", "iterator"]);
	`
		),
		windowTest(
			"callable-options",
			`
		function options() {}
		options.targetOrigin = "*";
		options.toString = () => { fail("callable dictionary coerced to string"); };
		window.postMessage("callable-options", options);
	`
		),
		windowTest(
			"null-origin-is-not-default",
			`
		let thrown;
		try { window.postMessage("ignored", { targetOrigin: null }); }
		catch (error) { thrown = error.name; }
		assertEqual(thrown, "SyntaxError");
	`
		),
		windowTest(
			"symbol-origin-throws",
			`
		for (const options of [Symbol(), { targetOrigin: Symbol() }]) {
			let thrown;
			try { window.postMessage("ignored", options); }
			catch (error) { thrown = error.name; }
			assertEqual(thrown, "TypeError");
		}
	`
		),
		windowTest(
			"rejected-message-preserves-once",
			`
		addEventListener("message", event => {
			assertEqual(event.data, "accepted"); pass();
		}, { once: true });
		window.postMessage("rejected", "https://unrelated.example");
		window.postMessage("accepted", "*");
	`,
			false
		),
		windowTest(
			"null-options-default",
			`
		addEventListener("message", event => {
			assertEqual(event.data, "null-options"); pass();
		}, { once: true });
		window.postMessage("null-options", null);
	`,
			false
		),

		// Omitted and "/" target origins allow only the caller's origin. The
		// options dictionary has the same default.
		crossOriginDelivery(
			"default-target-blocks-cross-origin",
			'target.postMessage("data-default-target-blocks-cross-origin");',
			false
		),
		crossOriginDelivery(
			"slash-target-blocks-cross-origin",
			'target.postMessage("data-slash-target-blocks-cross-origin", "/");',
			false
		),
		crossOriginDelivery(
			"empty-options-block-cross-origin",
			'target.postMessage("data-empty-options-block-cross-origin", {});',
			false
		),
		crossOriginDelivery(
			"options-wrong-origin-blocked",
			'target.postMessage("data-options-wrong-origin-blocked", { targetOrigin: "https://unrelated.example" });',
			false
		),
		crossOriginDelivery(
			"options-matching-origin-delivered",
			'target.postMessage("data-options-matching-origin-delivered", { targetOrigin: childOrigin });',
			true
		),
		crossOriginDelivery(
			"full-url-target-compares-only-origin",
			'target.postMessage("data-full-url-target-compares-only-origin", childOrigin + "/some/path?q=1#fragment");',
			true
		),
		crossOriginDelivery(
			"wildcard-delivers-cross-origin",
			'target.postMessage("data-wildcard-delivers-cross-origin", "*");',
			true
		),
		windowTest(
			"default-target-allows-self",
			`
			addEventListener("message", (event) => {
				if (event.data === "default-self") pass();
			}, { once: true });
			window.postMessage("default-self");
		`,
			false
		),
		windowTest(
			"slash-target-allows-self",
			`
			addEventListener("message", (event) => {
				if (event.data === "slash-self") pass();
			}, { once: true });
			window.postMessage("slash-self", "/");
		`,
			false
		),
		windowTest(
			"invalid-options-origin-syntax-error",
			`
			let name = "none";
			try { window.postMessage("ignored", { targetOrigin: "not a URL" }); }
			catch (error) { name = error.name; }
			assertEqual(name, "SyntaxError", "options.targetOrigin is URL-parsed");
		`
		),
		windowTest(
			"clone-error-precedes-target-filter",
			`
			let name = "none";
			try { window.postMessage(() => {}, "https://unrelated.example"); }
			catch (error) { name = error.name; }
			assertEqual(name, "DataCloneError", "cloning occurs before queued target filtering");
		`
		),
		// https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializewithtransfer
		windowTest(
			"duplicate-transfer-rejected",
			`
			const buffer = new ArrayBuffer(4);
			let name = "none";
			try { window.postMessage("ignored", "*", [buffer, buffer]); }
			catch (error) { name = error.name; }
			assertEqual(name, "DataCloneError", "duplicate transfer entries reject the send");
			assertEqual(buffer.byteLength, 4, "failed transfer leaves buffer attached");
		`
		),
		windowTest(
			"arraybuffer-transfer-detaches",
			`
			const buffer = new Uint8Array([3, 5, 8]).buffer;
			addEventListener("message", (event) => {
				if (event.data?.tag !== "buffer-transfer") return;
				assertDeepEqual(Array.from(new Uint8Array(event.data.buffer)), [3, 5, 8]);
				assertEqual(event.ports.length, 0, "ArrayBuffers do not appear in event.ports");
				pass();
			}, { once: true });
			window.postMessage({ tag: "buffer-transfer", buffer }, "*", [buffer]);
			assertEqual(buffer.byteLength, 0, "sender's buffer detached synchronously");
		`,
			false
		),
		windowTest(
			"arraybuffer-clone-keeps-sender",
			`
			const buffer = new Uint8Array([2, 4, 6]).buffer;
			addEventListener("message", (event) => {
				if (event.data?.tag !== "buffer-clone") return;
				assertEqual(buffer.byteLength, 3, "sender retains its buffer");
				assertDeepEqual(Array.from(new Uint8Array(event.data.buffer)), [2, 4, 6]);
				assert(event.data.buffer !== buffer, "receiver gets a distinct clone");
				pass();
			}, { once: true });
			window.postMessage({ tag: "buffer-clone", buffer }, "*");
		`,
			false
		),
		windowTest(
			"transfer-only-port-exposed",
			`
			const channel = new MessageChannel();
			addEventListener("message", (event) => {
				if (event.data !== "port-only") return;
				assertEqual(event.ports.length, 1, "transferred port appears in event.ports");
				event.ports[0].onmessage = (reply) => {
					assertEqual(reply.data, "port-reply", "transferred port remains usable");
					pass();
				};
				channel.port1.postMessage("port-reply");
			}, { once: true });
			window.postMessage("port-only", "*", [channel.port2]);
		`,
			false
		),
		windowTest(
			"structured-clone-cycle-and-shared-reference",
			`
			const shared = { value: 17 };
			const data = { tag: "graph", shared, again: shared, map: new Map([["k", shared]]) };
			data.self = data;
			addEventListener("message", (event) => {
				if (event.data?.tag !== "graph") return;
				const got = event.data;
				assert(got !== data, "message is cloned");
				assert(got.self === got, "cycle is preserved");
				assert(got.shared === got.again, "shared references retain identity");
				assert(got.map.get("k") === got.shared, "map value retains identity");
				pass();
			}, { once: true });
			window.postMessage(data, "*");
		`,
			false
		),
		windowTest(
			"dispatch-is-queued",
			`
			let returned = false;
			addEventListener("message", (event) => {
				if (event.data !== "queued") return;
				assertEqual(returned, true, "listener runs in a later task");
				assertEqual(event.source, window, "event.source is the sender window");
				pass();
			}, { once: true });
			window.postMessage("queued", "*");
			returned = true;
		`,
			false
		),
		windowTest(
			"multiple-messages-keep-order",
			`
			const received = [];
			addEventListener("message", (event) => {
				if (!Number.isInteger(event.data)) return;
				received.push(event.data);
				if (received.length === 3) {
					assertDeepEqual(received, [1, 2, 3], "postMessage task order");
					pass();
				}
			});
			window.postMessage(1, "*");
			window.postMessage(2, "*");
			window.postMessage(3, "*");
		`,
			false
		),
		windowTest(
			"reserved-property-payload-survives",
			`
			const data = {
				$scramjet$messagetype: "worker",
				$scramjet$data: "nested",
				$scramjet$origin: "https://untrusted.example",
				$scramjet$clientid: "not-a-client"
			};
			addEventListener("message", (event) => {
				if (event.data?.$scramjet$clientid !== "not-a-client") return;
				assertDeepEqual(event.data, data, "page data is not mistaken for the proxy envelope");
				pass();
			}, { once: true });
			window.postMessage(data, "*");
		`,
			false
		),
		basicTest({
			name: "pmatrix-messageport-options-buffer-transfer",
			autoPass: false,
			js: `
			const channel = new MessageChannel();
			const buffer = new Uint8Array([7, 9]).buffer;
			channel.port2.onmessage = (event) => {
				assertDeepEqual(Array.from(new Uint8Array(event.data.buffer)), [7, 9]);
				assertEqual(event.origin, "", "port messages have no origin");
				pass();
			};
			channel.port1.postMessage({ buffer }, { transfer: [buffer] });
			assertEqual(buffer.byteLength, 0, "port transfer detaches sender's buffer");
		`,
		}),
		basicTest({
			name: "pmatrix-messageport-transfer-only-port",
			autoPass: false,
			js: `
			const carrier = new MessageChannel();
			const transferred = new MessageChannel();
			carrier.port2.onmessage = (event) => {
				assertEqual(event.data, "port-carried", "payload arrived");
				assertEqual(event.ports.length, 1, "transferred port is in event.ports");
				event.ports[0].onmessage = (reply) => {
					assertEqual(reply.data, "usable", "transferred port is usable");
					pass();
				};
				transferred.port1.postMessage("usable");
			};
			carrier.port1.postMessage("port-carried", [transferred.port2]);
		`,
		}),
		basicTest({
			name: "pmatrix-worker-options-buffer-transfer",
			autoPass: false,
			js: `
			const source = 'self.onmessage = (event) => postMessage(Array.from(new Uint8Array(event.data.buffer)));';
			const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
			const buffer = new Uint8Array([11, 13]).buffer;
			worker.onmessage = (event) => {
				assertDeepEqual(event.data, [11, 13], "worker received transferred bytes");
				worker.terminate();
				pass();
			};
			worker.postMessage({ buffer }, { transfer: [buffer] });
			assertEqual(buffer.byteLength, 0, "worker transfer detaches sender's buffer");
		`,
		}),
	];
}

export default (["pst", "lazystamp"] as const).flatMap((value) => {
	mode = value;
	return cases().map((test) => {
		if (!test.name.includes(`pmatrix-${mode}-`))
			test.name = test.name.replace("pmatrix-", `pmatrix-${mode}-`);
		test.incumbencyMode = mode;
		return test;
	});
});

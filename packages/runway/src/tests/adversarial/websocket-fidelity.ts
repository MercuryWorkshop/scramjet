import { serverTest } from "../../testcommon.ts";
import { WebSocketServer } from "ws";
import type { Server } from "http";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// `shared/requests/WebSocket.ts` does not wrap a real WebSocket, it builds an
// EventTarget, reparents it onto `WebSocket.prototype` and answers every
// member out of a side table. That buys a socket the proxy can carry, and it
// means every observable a real socket has must be reproduced by hand - so
// this covers the ones that are cheap for a page to look at.

function echo(server: Server) {
	const wss = new WebSocketServer({ server });

	wss.on("connection", (socket) => {
		socket.on("message", (message, isBinary) => {
			socket.send(message, { binary: isBinary });
		});
	});

	return wss;
}

export default [
	// https://html.spec.whatwg.org/multipage/webappapis.html#activate-an-event-handler
	//
	// An `on*` handler is a listener like any other, added when it is first
	// set - so one set after an addEventListener runs after it. Replacing the
	// handler keeps that place; clearing it and setting it again moves it to
	// the end.
	serverTest({
		name: "wsfidelity-handler-listener-order",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			const order = [];
			let round = 0;
			socket.addEventListener("message", () => order.push("a"));
			socket.onmessage = () => order.push("h1");
			socket.addEventListener("message", () => order.push("b"));
			socket.addEventListener("message", () => {
				round++;
				if (round === 1) {
					// replaced in place: still between a and b
					socket.onmessage = () => order.push("h2");
					socket.send("two");
				} else if (round === 2) {
					// cleared and set again: now last
					socket.onmessage = null;
					socket.onmessage = () => order.push("h3");
					socket.send("three");
				} else {
					// h3 is after this listener, so check once the dispatch is done
					setTimeout(() => {
						socket.close();
						assertEqual(
							order.join(","),
							"a,h1,b,a,h2,b,a,b,h3",
							"the handler runs where it was added"
						);
						pass();
					});
				}
			});
			socket.onopen = () => socket.send("one");
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the handler is invoked by the dispatch, with the socket as `this`,
	// `target` set and `isTrusted` true - not called by hand ahead of it
	serverTest({
		name: "wsfidelity-handler-sees-the-dispatched-event",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.onmessage = function (e) {
				const got = {
					thisIsSocket: this === socket,
					target: e.target === socket,
					trusted: e.isTrusted,
					data: e.data,
				};
				socket.close();
				assertEqual(JSON.stringify(got), JSON.stringify({
					thisIsSocket: true, target: true, trusted: true, data: "hi",
				}), "the handler sees the dispatched event");
				pass();
			};
			socket.onopen = () => socket.send("hi");
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// [LegacyTreatNonObjectAsNull]: a primitive is null, an object is kept and
	// read back as itself, and neither throws when the event fires
	serverTest({
		name: "wsfidelity-handler-value-conversion",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.onmessage = 5;
			assertEqual(socket.onmessage, null, "a primitive reads back as null");
			const obj = {};
			socket.onmessage = obj;
			assert(socket.onmessage === obj, "an object reads back as itself");
			socket.addEventListener("message", () => {
				socket.close();
				pass();
			});
			socket.onopen = () => socket.send("x");
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// A WebSocket has no own properties at all: `url`, `readyState` and the
	// event handlers are all prototype accessors, and `constructor` is on the
	// prototype too. An own property of any name is a one-expression tell.
	serverTest({
		name: "wsfidelity-instance-has-no-own-properties",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				const own = Object.getOwnPropertyNames(socket);
				socket.close();
				assertEqual(
					own.join(","),
					"",
					"a WebSocket instance has no own properties"
				);
				pass();
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://dom.spec.whatwg.org/#dom-event-istrusted
	//
	// Every event a socket fires is dispatched by the browser, so `isTrusted`
	// is true - and it has to be true for both ways of listening, not just the
	// `onopen` half.
	serverTest({
		name: "wsfidelity-events-are-trusted",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", (event) => {
				const trusted = event.isTrusted;
				socket.close();
				assertEqual(
					trusted,
					true,
					"an open event delivered to addEventListener is trusted"
				);
				pass();
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-close
	//
	// `close(code)` is `[Clamp] unsigned short`, and the code must then be 1000
	// or in 3000-4999. 70000 clamps to 65535, which is neither, so it is an
	// InvalidAccessError. Converting it as a plain `unsigned short` wraps it to
	// 4464 instead, which is inside the allowed range - so the call silently
	// succeeds and closes the socket with a code the page never named.
	serverTest({
		name: "wsfidelity-close-code-is-clamped",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				let threw = null;
				try {
					socket.close(70000);
				} catch (error) {
					threw = error.name;
				}
				try {
					socket.close();
				} catch {}
				assertEqual(
					threw,
					"InvalidAccessError",
					"close(70000) clamps to 65535 and is rejected"
				);
				pass();
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-send
	//
	// `send()` before the handshake finishes is an InvalidStateError, which is
	// how a page detects that it raced its own open.
	serverTest({
		name: "wsfidelity-send-while-connecting-throws",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			assertEqual(socket.readyState, WebSocket.CONNECTING, "socket is connecting");

			let threw = null;
			try {
				socket.send("too early");
			} catch (error) {
				threw = error.name;
			}
			socket.addEventListener("open", () => socket.close());
			assertEqual(
				threw,
				"InvalidStateError",
				"send() while CONNECTING throws InvalidStateError"
			);
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-close step 3.2
	//
	// A close during CONNECTING fails the connection: CLOSING at once, never
	// an `open`, then `error` and a `close` with 1006 and wasClean false. The
	// state only ever moves forward.
	serverTest({
		name: "wsfidelity-close-while-connecting-fails",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			const seen = [];
			const states = [socket.readyState];
			socket.close();
			states.push(socket.readyState);
			socket.addEventListener("open", () => seen.push("open"));
			socket.addEventListener("error", () => {
				seen.push("error");
				states.push(socket.readyState);
			});
			socket.addEventListener("close", (e) => {
				seen.push("close:" + e.code + ":" + e.wasClean);
				states.push(socket.readyState);
				// long enough for the handshake to finish behind it
				setTimeout(() => {
					states.push(socket.readyState);
					assertEqual(seen.join(","), "error,close:1006:false", "the connection fails");
					assertEqual(states.join(","), "0,2,3,3,3", "readyState only moves forward");
					pass();
				}, 300);
			});
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-close step 3.4 and
	// #dom-websocket-send - after close() the socket is CLOSING: a second
	// close() does nothing, a send() is discarded and neither throws, and the
	// closing handshake completes cleanly.
	serverTest({
		name: "wsfidelity-closing-state",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				socket.close(1000, "bye");
				assertEqual(socket.readyState, WebSocket.CLOSING, "CLOSING after close()");
				socket.close(3001);
				assertEqual(socket.send("late"), undefined, "a send while CLOSING returns undefined");
				assertEqual(socket.readyState, WebSocket.CLOSING, "still CLOSING");
			});
			socket.addEventListener("message", () => fail("a discarded send was echoed"));
			socket.addEventListener("close", (e) => {
				assertEqual(e.code + ":" + e.reason + ":" + e.wasClean, "1000:bye:true", "a clean close");
				assertEqual(socket.readyState, WebSocket.CLOSED, "CLOSED");
				pass();
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			echo(server);
		},
	}),

	// send() returns undefined, not the transport's promise
	serverTest({
		name: "wsfidelity-send-returns-undefined",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				assertEqual(socket.send("x"), undefined, "send() returns undefined");
			});
			socket.addEventListener("message", () => {
				socket.close();
				pass();
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			echo(server);
		},
	}),

	// frames reach the page in the order they were sent, whatever each one
	// takes to convert
	serverTest({
		name: "wsfidelity-message-order",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.binaryType = "arraybuffer";
			const got = [];
			socket.addEventListener("message", (e) => {
				got.push(typeof e.data === "string" ? e.data : "bin" + e.data.byteLength);
				if (got.length === 4) {
					socket.close();
					assertEqual(got.join(","), "bin3,a,bin1,b", "messages arrive in order");
					assertEqual(e.origin, "ws://localhost:" + location.port, "origin is the socket's");
					pass();
				}
			});
			socket.addEventListener("error", () => fail("socket errored"));
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket) => {
				socket.send(Buffer.from([1, 2, 3]), { binary: true });
				socket.send("a");
				socket.send(Buffer.from([4]), { binary: true });
				socket.send("b");
			});
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-websocket steps 1-6
	serverTest({
		name: "wsfidelity-url-parsing",
		autoPass: false,
		js: `
			const relative = new WebSocket("/sock?x=1");
			assertEqual(relative.url, "ws://localhost:" + location.port + "/sock?x=1", "resolved and mapped to ws:");
			relative.close();

			const errorName = (url) => {
				try {
					new WebSocket(url);
				} catch (e) {
					return e.name;
				}
				return "none";
			};
			assertEqual(errorName("ftp://localhost/"), "SyntaxError", "a non-ws scheme");
			assertEqual(errorName("ws://localhost/#frag"), "SyntaxError", "a fragment");
			assertEqual(errorName("ws://localhost/#"), "SyntaxError", "an empty fragment");
			assertEqual(errorName("http://[::1"), "SyntaxError", "an unparseable URL");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// The handshake carries the page's origin and the *target's* cookies: a
	// socket to another site is not sent the page's own
	serverTest({
		name: "wsfidelity-handshake-cookies-and-origin",
		autoPass: false,
		js: `
			document.cookie = "wsfidelity=page";
			const ask = (host) => new Promise((resolve, reject) => {
				const socket = new WebSocket("ws://" + host + ":" + location.port);
				socket.onmessage = (e) => {
					socket.close();
					resolve(JSON.parse(e.data));
				};
				socket.onerror = () => reject(new Error("socket to " + host + " errored"));
			});
			const same = await ask("localhost");
			assertEqual(same.origin, location.origin, "Origin is the page's");
			assert((same.cookie || "").includes("wsfidelity=page"), "a same-site socket carries the cookie");
			const cross = await ask("127.0.0.1");
			assert(!(cross.cookie || "").includes("wsfidelity=page"), "a cross-site socket does not: " + cross.cookie);
			pass();
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket, req) => {
				socket.send(
					JSON.stringify({
						origin: req.headers.origin,
						cookie: req.headers.cookie,
					})
				);
			});
		},
	}),

	// WebSocketStream: a relative URL opens, messages read in order and the
	// readable ends when the server closes, and there are no own properties
	serverTest({
		name: "wsfidelity-stream-reads-to-close",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const wss = new WebSocketStream("/");
			assertEqual(wss.url, "ws://localhost:" + location.port + "/", "resolved and mapped to ws:");
			assertEqual(Object.getOwnPropertyNames(wss).join(","), "", "no own properties");
			const { readable } = await wss.opened;
			const got = [];
			for await (const chunk of readable) got.push(chunk);
			assertEqual(got.join(","), "a,b", "read to the end");
			// resolving at all is the clean close. The code is not checked:
			// the harness transport reports closes without one
			const info = await wss.closed;
			assertEqual(typeof info.closeCode, "number", "closed cleanly");
			pass();
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket) => {
				socket.send("a");
				socket.send("b");
				socket.close(1000);
			});
		},
	}),

	// WebSocketStream close() before the handshake finishes rejects both
	// promises rather than throwing
	serverTest({
		name: "wsfidelity-stream-close-while-connecting",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const wss = new WebSocketStream("ws://localhost:" + location.port);
			wss.close();
			const opened = await wss.opened.then(() => "resolved", () => "rejected");
			const closed = await wss.closed.then(() => "resolved", () => "rejected");
			assertEqual(opened + "," + closed, "rejected,rejected", "both reject");

			const ctl = new AbortController();
			const aborted = new WebSocketStream("ws://localhost:" + location.port, { signal: ctl.signal });
			ctl.abort();
			const r = await aborted.opened.then(() => "resolved", (e) => e.name);
			assertEqual(r, "AbortError", "an abort rejects with the signal's reason");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-websocket steps 8-9:
	// a repeated protocol, or one that is not an HTTP token, is a SyntaxError
	// at construction
	serverTest({
		name: "wsfidelity-protocols-are-validated",
		autoPass: false,
		js: `
			const errorName = (protocols) => {
				try {
					new WebSocket("ws://localhost:" + location.port, protocols).close();
				} catch (e) {
					return e.name;
				}
				return "none";
			};
			assertEqual(errorName(["a", "a"]), "SyntaxError", "a repeated protocol");
			assertEqual(errorName("a b"), "SyntaxError", "a space is not a token character");
			assertEqual(errorName(""), "SyntaxError", "an empty protocol");
			assertEqual(errorName(["chat", "superchat"]), "none", "two distinct tokens");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the server picks one of the offered protocols, and `protocol` reports
	// it once open - and only then.
	//
	// Expected to fail under the harness: the libcurl transport calls
	// `onopen("", "")`, so the negotiated protocol never reaches scramjet
	serverTest({
		name: "wsfidelity-protocol-negotiated",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port, ["one", "two"]);
			assertEqual(socket.protocol, "", "no protocol while connecting");
			socket.onopen = () => {
				assertEqual(socket.protocol, "two", "the server's choice");
				socket.close();
				pass();
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			new WebSocketServer({
				server,
				handleProtocols: (protocols) => (protocols.has("two") ? "two" : false),
			});
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocket-close - the code and
	// reason are checked before the state is, so they throw on a closed
	// socket too, and a valid close() on one does nothing
	serverTest({
		name: "wsfidelity-close-argument-validation",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			const errorName = (...args) => {
				try {
					socket.close(...args);
				} catch (e) {
					return e.name;
				}
				return "none";
			};
			const check = (phase) => {
				assertEqual(errorName(999), "InvalidAccessError", phase + ": 999");
				assertEqual(errorName(1001), "InvalidAccessError", phase + ": 1001 is reserved");
				assertEqual(errorName(2999), "InvalidAccessError", phase + ": 2999");
				assertEqual(errorName(5000), "InvalidAccessError", phase + ": 5000");
				assertEqual(errorName(1000, "x".repeat(124)), "SyntaxError", phase + ": 124 byte reason");
				// 41 three-byte characters are 123 bytes; 42 are 126
				assertEqual(errorName(1000, "\\u20ac".repeat(42)), "SyntaxError", phase + ": the reason is measured in UTF-8 bytes");
			};
			socket.onopen = () => {
				check("open");
				assertEqual(errorName(4999, "\\u20ac".repeat(41)), "none", "the largest valid close");
				socket.onclose = (e) => {
					assertEqual(e.code + ":" + e.reason.length, "4999:41", "the close the page sent");
					check("closed");
					assertEqual(errorName(1000), "none", "close() on a closed socket does nothing");
					assertEqual(errorName(), "none", "nor does close() with no code");
					pass();
				};
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// a send on a CLOSED socket is discarded without throwing, like one on a
	// CLOSING socket
	serverTest({
		name: "wsfidelity-send-after-closed",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.onopen = () => socket.close();
			socket.onclose = () => {
				assertEqual(socket.readyState, WebSocket.CLOSED, "closed");
				assertEqual(socket.send("late"), undefined, "no throw, undefined");
				assertEqual(socket.send(new Uint8Array(4)), undefined, "binary too");
				pass();
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// https://websockets.spec.whatwg.org/#feedback-from-the-protocol - a
	// connection that never opens fails: `error`, then `close` with 1006 and
	// wasClean false, and never `open`.
	//
	// Expected to fail under the harness: the libcurl transport never reports
	// a refused connection at all, so the socket stays CONNECTING
	serverTest({
		name: "wsfidelity-connection-refused",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:1");
			const seen = [];
			socket.onopen = () => seen.push("open");
			socket.onerror = (e) => seen.push("error:" + e.constructor.name + ":" + socket.readyState);
			socket.onclose = (e) => {
				seen.push("close:" + e.code + ":" + e.wasClean + ":" + socket.readyState);
				assertEqual(seen.join(","), "error:Event:3,close:1006:false:3", "the connection fails");
				pass();
			};
		`,
		async start() {},
	}),

	// a connection that drops without a closing handshake after it opened
	// closes with 1006 and wasClean false.
	//
	// Expected to fail under the harness: the libcurl transport does not
	// notice a TCP connection dropping without a close frame
	serverTest({
		name: "wsfidelity-abnormal-closure",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			let opened = false;
			socket.onopen = () => (opened = true);
			socket.onclose = (e) => {
				assert(opened, "it opened first");
				assertEqual(e.code + ":" + e.wasClean, "1006:false", "an abnormal closure");
				assertEqual(socket.readyState, WebSocket.CLOSED, "closed");
				pass();
			};
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket) =>
				setTimeout(() => socket.terminate(), 50)
			);
		},
	}),

	// binaryType defaults to "blob", ignores values outside the enum, and
	// decides the type of each binary message as it arrives
	serverTest({
		name: "wsfidelity-binarytype",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			assertEqual(socket.binaryType, "blob", "the default");
			socket.binaryType = "nodebuffer";
			assertEqual(socket.binaryType, "blob", "an invalid value is ignored");
			const got = [];
			socket.onmessage = async (e) => {
				got.push(e.data);
				if (got.length === 1) {
					socket.binaryType = "arraybuffer";
					socket.send(new Uint8Array([9, 9]));
					return;
				}
				assert(got[0] instanceof Blob, "a Blob while binaryType is blob");
				assertEqual(got[0].size, 3, "the Blob's size");
				assertDeepEqual([...new Uint8Array(await got[0].arrayBuffer())], [1, 2, 3], "the Blob's bytes");
				assert(got[1] instanceof ArrayBuffer, "an ArrayBuffer after switching");
				assertDeepEqual([...new Uint8Array(got[1])], [9, 9], "the ArrayBuffer's bytes");
				socket.close();
				pass();
			};
			socket.onopen = () => socket.send(new Uint8Array([1, 2, 3]));
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// every BufferSource sends only the bytes it views, a Blob sends its
	// contents, and anything else is stringified
	serverTest({
		name: "wsfidelity-send-data-types",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.binaryType = "arraybuffer";
			const backing = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
			const sent = [
				["arraybuffer", new Uint8Array([1, 2]).buffer, "1,2"],
				["subarray", backing.subarray(2, 5), "2,3,4"],
				["dataview", new DataView(backing.buffer, 6, 2), "6,7"],
				["blob", new Blob([new Uint8Array([7, 7, 7])]), "7,7,7"],
				["number", 42, "42"],
				["object", { toString: () => "str" }, "str"],
			];
			const got = [];
			socket.onmessage = (e) => {
				got.push(typeof e.data === "string" ? e.data : [...new Uint8Array(e.data)].join(","));
				if (got.length === sent.length) {
					socket.close();
					for (let i = 0; i < sent.length; i++) {
						assertEqual(got[i], sent[i][2], sent[i][0]);
					}
					pass();
				}
			};
			socket.onopen = () => {
				for (const [, data] of sent) socket.send(data);
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the events a socket fires are the right interfaces, carrying what a
	// real socket's carry
	serverTest({
		name: "wsfidelity-event-shapes",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.onopen = (e) => {
				assertEqual(Object.getPrototypeOf(e), Event.prototype, "open is a plain Event");
				assertEqual(e.type + ":" + e.bubbles + ":" + e.cancelable, "open:false:false", "open's flags");
				socket.send("hi");
			};
			socket.onmessage = (e) => {
				assertEqual(Object.getPrototypeOf(e), MessageEvent.prototype, "message is a MessageEvent");
				assertEqual(e.origin, "ws://localhost:" + location.port, "origin");
				assertEqual(e.lastEventId, "", "lastEventId");
				assertEqual(e.source, null, "source");
				assertEqual(e.ports.length, 0, "ports");
				socket.close(3000, "done");
			};
			socket.onclose = (e) => {
				assertEqual(Object.getPrototypeOf(e), CloseEvent.prototype, "close is a CloseEvent");
				assertEqual(e.code + ":" + e.reason + ":" + e.wasClean, "3000:done:true", "the close");
				assert(e.target === socket && e.currentTarget === socket, "targeted at the socket");
				pass();
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the object itself: its prototype chain, stringification, constants and
	// the attributes it answers before anything has happened
	serverTest({
		name: "wsfidelity-object-shape",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port + "/a b?c=d");
			assert(socket instanceof WebSocket && socket instanceof EventTarget, "instanceof");
			assertEqual(Object.getPrototypeOf(socket), WebSocket.prototype, "prototype");
			assertEqual(String(socket), "[object WebSocket]", "toStringTag");
			assertEqual(socket.url, "ws://localhost:" + location.port + "/a%20b?c=d", "the URL is serialized");
			assertEqual([socket.CONNECTING, socket.OPEN, socket.CLOSING, socket.CLOSED].join(","), "0,1,2,3", "instance constants");
			assertEqual(socket.bufferedAmount, 0, "bufferedAmount");
			assertEqual(socket.extensions, "", "extensions");
			assertEqual(socket.onopen, null, "onopen");
			socket.close();
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the constructor and the prototype's members still brand-check: a
	// receiver that is not a socket throws, as it does natively
	serverTest({
		name: "wsfidelity-brand-checks",
		autoPass: false,
		js: `
			const errorName = (fn) => {
				try {
					fn();
				} catch (e) {
					return e.name;
				}
				return "none";
			};
			const proto = WebSocket.prototype;
			const getter = (name) => Object.getOwnPropertyDescriptor(proto, name).get;
			assertEqual(errorName(() => WebSocket("ws://localhost")), "TypeError", "called without new");
			assertEqual(errorName(() => new WebSocket()), "TypeError", "no URL");
			assertEqual(errorName(() => proto.readyState), "TypeError", "readyState on the prototype");
			assertEqual(errorName(() => getter("url").call({})), "TypeError", "url on a plain object");
			assertEqual(errorName(() => proto.send.call({}, "x")), "TypeError", "send on a plain object");
			assertEqual(errorName(() => proto.close.call(Object.create(proto))), "TypeError", "close on a fake");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the handshake: the offered protocols, the page's User-Agent, and an
	// HttpOnly cookie the page cannot read but the socket still carries
	serverTest({
		name: "wsfidelity-handshake-headers",
		autoPass: false,
		js: `
			await fetch("/set-cookie");
			assert(!document.cookie.includes("wsfidelity_http"), "the cookie is HttpOnly");
			const socket = new WebSocket("ws://localhost:" + location.port, ["p1", "p2"]);
			socket.onmessage = (e) => {
				const got = JSON.parse(e.data);
				socket.close();
				assertEqual(got.protocol, "p1, p2", "Sec-WebSocket-Protocol");
				assertEqual(got.ua, navigator.userAgent, "User-Agent");
				assert((got.cookie || "").includes("wsfidelity_http=1"), "the HttpOnly cookie is sent: " + got.cookie);
				pass();
			};
			socket.onerror = () => fail("socket errored");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url !== "/set-cookie") return;
				res.writeHead(200, {
					"Set-Cookie": "wsfidelity_http=1; HttpOnly; Path=/",
				});
				res.end("ok");
			});
			const wss = new WebSocketServer({ server, handleProtocols: () => "p1" });
			wss.on("connection", (socket, req) => {
				socket.send(
					JSON.stringify({
						protocol: req.headers["sec-websocket-protocol"],
						ua: req.headers["user-agent"],
						cookie: req.headers.cookie,
					})
				);
			});
		},
	}),

	// https://websockets.spec.whatwg.org/#dom-websocketstream-close - the
	// same code and reason rules. Chrome's closeCode is [Clamp], like
	// WebSocket's close(): 70000 pins to 65535 and NaN to 0, and both are then
	// the wrong code rather than a conversion failure
	serverTest({
		name: "wsfidelity-stream-close-validation",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const wss = new WebSocketStream("ws://localhost:" + location.port);
			await wss.opened;
			const errorName = (info) => {
				try {
					wss.close(info);
				} catch (e) {
					return e.name;
				}
				return "none";
			};
			assertEqual(errorName({ closeCode: 999 }), "InvalidAccessError", "999");
			assertEqual(errorName({ closeCode: 70000 }), "InvalidAccessError", "70000 clamps to 65535");
			assertEqual(errorName({ closeCode: NaN }), "InvalidAccessError", "NaN clamps to 0");
			assertEqual(errorName({ reason: "x".repeat(124) }), "SyntaxError", "a long reason with no code");
			assertEqual(errorName(5), "TypeError", "not a dictionary");
			assertEqual(errorName({ closeCode: 3000, reason: "ok" }), "none", "a valid close");
			const info = await wss.closed;
			assertEqual(info.closeCode + ":" + info.reason, "3000:ok", "the close the page sent");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the writable sends text and bytes, the readable reads the echo back,
	// and cancelling the readable closes the stream cleanly
	serverTest({
		name: "wsfidelity-stream-echo-and-cancel",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const wss = new WebSocketStream("ws://localhost:" + location.port);
			const { readable, writable, protocol, extensions } = await wss.opened;
			assertEqual(protocol + "|" + extensions, "|", "no protocol or extensions");
			const writer = writable.getWriter();
			const reader = readable.getReader();
			await writer.write("text");
			await writer.write(new Uint8Array([1, 2, 3]));
			const a = await reader.read();
			const b = await reader.read();
			assertEqual(a.value, "text", "text echoes as a string");
			assertDeepEqual([...new Uint8Array(b.value)], [1, 2, 3], "bytes echo as bytes");
			await reader.cancel();
			const info = await wss.closed;
			assertEqual(typeof info.closeCode, "number", "closed cleanly");
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// the signal governs the handshake only: already aborted, nothing
	// connects and both promises reject with one AbortError - not with the
	// signal's reason, which Chrome ignores; aborted once open, nothing happens
	serverTest({
		name: "wsfidelity-stream-signal",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const reason = new Error("stop");
			const pre = new WebSocketStream("ws://localhost:" + location.port, { signal: AbortSignal.abort(reason) });
			const openedError = await pre.opened.catch((e) => e);
			assertEqual(openedError.name, "AbortError", "already aborted: opened rejects with an AbortError");
			assert(openedError instanceof DOMException, "a DOMException");
			assert((await pre.closed.catch((e) => e)) === openedError, "closed rejects with the same one");

			let threw = null;
			try {
				new WebSocketStream("ws://localhost:" + location.port, { signal: {} });
			} catch (e) {
				threw = e.name;
			}
			assertEqual(threw, "TypeError", "a signal that is not an AbortSignal");

			const ctl = new AbortController();
			const late = new WebSocketStream("ws://localhost:" + location.port, { signal: ctl.signal });
			const { readable, writable } = await late.opened;
			ctl.abort();
			const writer = writable.getWriter();
			await writer.write("still open");
			const { value } = await readable.getReader().read();
			assertEqual(value, "still open", "an abort after open does nothing");
			late.close();
			pass();
		`,
		async start(server) {
			echo(server);
		},
	}),

	// a stream that never connects rejects both promises.
	//
	// Expected to fail under the harness, for the reason
	// wsfidelity-connection-refused does
	serverTest({
		name: "wsfidelity-stream-connection-refused",
		autoPass: false,
		js: `
			if (typeof WebSocketStream === "undefined") { pass("no WebSocketStream"); return; }
			const wss = new WebSocketStream("ws://localhost:1");
			const opened = await wss.opened.then(() => "resolved", (e) => "rejected:" + e.name);
			const closed = await wss.closed.then(() => "resolved", (e) => "rejected:" + e.name);
			assertEqual(opened + "," + closed, "rejected:WebSocketError,rejected:WebSocketError", "both reject");
			pass();
		`,
		async start() {},
	}),
];

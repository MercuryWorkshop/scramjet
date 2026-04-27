import { serverTest } from "../testcommon.ts";
import { WebSocketServer } from "ws";
import { Server } from "http";

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
	serverTest({
		name: "websockets-sanity",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				socket.send("Hello, server!");
			});
			socket.addEventListener("message", (event) => {
				assert(event.data === "Hello, server!", "Echoed message should match sent message");
				pass("WebSocket echo successful");
			});
			socket.addEventListener("error", (event) => {
				fail("WebSocket error: " + event.message);
			});
			socket.addEventListener("close", () => {
				console.log("WebSocket connection closed");
			});
		`,
		async start(server) {
			echo(server);
		},
	}),
	serverTest({
		name: "websockets-binary",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.binaryType = "arraybuffer";
			socket.addEventListener("open", () => {
				const buffer = new ArrayBuffer(8);
				const view = new Uint8Array(buffer);
				for (let i = 0; i < view.length; i++) {
					view[i] = i;
				}
				socket.send(buffer);
			});
			socket.addEventListener("message", (event) => {
				const view = new Uint8Array(event.data);
				for (let i = 0; i < view.length; i++) {
					assert(view[i] === i, "Echoed binary data should match sent data");
				}
				pass("WebSocket binary echo successful");
			});
			socket.addEventListener("error", (event) => {
				fail("WebSocket error: " + event.message);
			});
		`,
		async start(server) {
			echo(server);
		},
	}),
	serverTest({
		name: "websockets-blob",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.binaryType = "blob";
			socket.addEventListener("open", () => {
				const blob = new Blob(["Hello, binary blob!"], { type: "text/plain" });
				socket.send(blob);
			});
			socket.addEventListener("message", (event) => {
				const reader = new FileReader();
				reader.onload = () => {
					assert(reader.result === "Hello, binary blob!", "Echoed blob data should match sent data");
					pass("WebSocket blob echo successful");
				};
				reader.readAsText(event.data);
			});
			socket.addEventListener("error", (event) => {
				fail("WebSocket error: " + event.message);
			});
		`,
		async start(server) {
			echo(server);
		},
	}),
	serverTest({
		name: "websockets-origin-header",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("message", (event) => {
				assert(event.data === "http://localhost:" + location.port, "Origin header should match");
				pass("WebSocket Host header check successful");
			});
			socket.addEventListener("error", (event) => {
				fail("WebSocket error: " + event.message);
			});
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket, request) => {
				socket.send(request.headers.origin!);
			});
		},
	}),
	serverTest({
		name: "websockets-relative-url",
		autoPass: false,
		js: `
				const socket = new WebSocket("/");
				socket.addEventListener("open", () => {
					pass("WebSocket connected to server");
				});
				socket.addEventListener("error", (event) => {
					fail("WebSocket error: " + event.message);
				});
			`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", () => {});
		},
	}),
	serverTest({
		name: "websocketstream-sanity",
		autoPass: false,
		js: `
			assert(typeof WebSocketStream === "function", "WebSocketStream should exist");

			const stream = new WebSocketStream("ws://localhost:" + location.port);
			const { readable, writable } = await stream.opened;

			const writer = writable.getWriter();
			await writer.write("Hello from WebSocketStream");
			writer.releaseLock();

			const reader = readable.getReader();
			const result = await reader.read();
			reader.releaseLock();

			assert(!result.done, "Readable stream should produce a message");
			assert(result.value === "Hello from WebSocketStream", "Echoed message should match sent data");

			stream.close({ closeCode: 1000, reason: "done" });
			const closeInfo = await stream.closed;
			assert(closeInfo.closeCode === 1000, "WebSocketStream should close with normal code");
			
			pass("WebSocketStream echo successful");
		`,
		async start(server) {
			echo(server);
		},
	}),
	serverTest({
		name: "websocketstream-binary",
		autoPass: false,
		js: `
			assert(typeof WebSocketStream === "function", "WebSocketStream should exist");

			const stream = new WebSocketStream("ws://localhost:" + location.port);
			const { readable, writable } = await stream.opened;

			const payload = new ArrayBuffer([0, 1, 2, 3, 4, 5, 6, 7]);
			const writer = writable.getWriter();
			await writer.write(payload);
			writer.releaseLock();

			const reader = readable.getReader();
			const result = await reader.read();
			reader.releaseLock();

			assert(!result.done, "Readable stream should produce a binary message");
			// TODO: this needs to be changed to uint8array later, chrome isnt following spec though so we are just going to do this
			assert(result.value instanceof ArrayBuffer, "Binary message should be ArrayBuffer");
			
			stream.close({ closeCode: 1000, reason: "done" });
			await stream.closed;
			pass("WebSocketStream binary echo successful");
		`,
		async start(server) {
			echo(server);
		},
	}),
	serverTest({
		name: "websocketstream-origin-header",
		autoPass: false,
		scramjetOnly: true,
		js: `
			assert(typeof WebSocketStream === "function", "WebSocketStream should exist");

			const stream = new WebSocketStream("ws://localhost:" + location.port);
			const { readable } = await stream.opened;

			const reader = readable.getReader();
			const result = await reader.read();
			reader.releaseLock();

			assert(!result.done, "Readable stream should produce an origin value");
			assert(result.value === "http://localhost:" + location.port, "Origin header should match");

			stream.close({ closeCode: 1000, reason: "done" });
			await stream.closed;
			pass("WebSocketStream origin header check successful");
		`,
		async start(server) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket, request) => {
				socket.send(request.headers.origin || "");
			});
		},
	}),
];

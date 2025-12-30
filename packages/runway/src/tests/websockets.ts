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
		async start(server, port) {
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
		async start(server, port) {
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
		async start(server, port) {
			echo(server);
		},
	}),
	serverTest({
		name: "websockets-host-header",
		autoPass: false,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			socket.addEventListener("open", () => {
				socket.send("Check Host header");
			});
			socket.addEventListener("message", (event) => {
				assert(event.data === "localhost:" + location.port, "Host header should match");
				pass("WebSocket Host header check successful");
			});
			socket.addEventListener("error", (event) => {
				fail("WebSocket error: " + event.message);
			});
		`,
		async start(server, port) {
			const wss = new WebSocketServer({ server });
			wss.on("connection", (socket, request) => {
				socket.on("message", (message) => {
					let text = message.toString();
					if (text === "Check Host header") {
						socket.send(request.headers.host);
					}
				});
			});
		},
	}),
];

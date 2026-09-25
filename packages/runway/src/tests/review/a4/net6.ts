import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";
import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-f-ws-refused-events",
		`
		const socket = new WebSocket("ws://localhost:1");
		const seen = [];
		socket.onopen = () => seen.push("open");
		socket.onerror = () => seen.push("error:" + socket.readyState);
		socket.onclose = (e) => seen.push("close:" + e.code);
		await new Promise(r => setTimeout(r, 8000));
		assert(seen.some(s => s.startsWith("close")) || seen.some(s => s.startsWith("error")), "some failure event fired: " + seen.join());
	`
	),
	t(
		"rv4-f-ws-bad-host-events",
		`
		const socket = new WebSocket("wss://nonexistent-host-rv4.invalid/");
		const seen = [];
		socket.onerror = () => seen.push("error");
		socket.onclose = (e) => seen.push("close:" + e.code);
		await new Promise(r => setTimeout(r, 8000));
		assert(seen.length > 0, "failure events: " + seen.join());
	`
	),
	serverTest({
		name: "rv4-f-ws-terminate-events",
		autoPass: true,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port);
			const seen = [];
			socket.onopen = () => seen.push("open");
			socket.onerror = () => seen.push("error");
			socket.onclose = (e) => seen.push("close:" + e.code);
			await new Promise(r => setTimeout(r, 6000));
			assert(seen.some(s => s.startsWith("close")), "close after terminate: " + seen.join());
		`,
		async start(server) {
			const wss = new WebSocketServer({
				server,
			});
			wss.on("connection", (s) => setTimeout(() => s.terminate(), 50));
		},
	}),
	serverTest({
		name: "rv4-f-ws-rejected-upgrade",
		autoPass: true,
		js: `
			const socket = new WebSocket("ws://localhost:" + location.port + "/nope");
			const seen = [];
			socket.onopen = () => seen.push("open");
			socket.onerror = () => seen.push("error");
			socket.onclose = (e) => seen.push("close:" + e.code);
			await new Promise(r => setTimeout(r, 6000));
			assert(seen.some(s => s.startsWith("close")), "close after rejected upgrade: " + seen.join());
		`,
		async start(server) {
			server.on("upgrade", (req, sock) => {
				sock.write("HTTP/1.1 403 Forbidden\\r\\n\\r\\n");
				sock.destroy();
			});
		},
	}),
	serverTest({
		name: "rv4-f-ws-subclass",
		autoPass: true,
		js: `
			class My extends WebSocket { constructor(u) { super(u); this.tag = 1; } hello() { return 2; } }
			const s = new My("ws://localhost:" + location.port);
			assertEqual(s.tag, 1, "field");
			assert(s instanceof WebSocket, "instanceof WebSocket");
			await new Promise((res, rej) => { s.onopen = res; s.onerror = () => rej(new Error("err")); });
			s.close();
			console.log("subclass instanceof My", s instanceof My);
		`,
		async start(server) {
			new WebSocketServer({
				server,
			});
		},
	}),
];

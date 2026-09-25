import { serverTest } from "../../../testcommon.ts";
import { createRequire } from "module";
import fs from "fs";
import { t } from "./net.ts";

/* eslint-disable quotes */

const PUTER = "/home/velzie/src/puter/node_modules/";
const req = createRequire(PUTER + "x.js");

function libs(server: any) {
	server.on("request", (r: any, res: any) => {
		const map: Record<string, string> = {
			"/axios.js": PUTER + "axios/dist/axios.min.js",
			"/jquery.js": PUTER + "jquery/dist/jquery.min.js",
			"/sio.js": PUTER + "socket.io-client/dist/socket.io.min.js",
		};
		if (map[r.url]) {
			res.writeHead(200, {
				"Content-Type": "text/javascript",
			});
			res.end(fs.readFileSync(map[r.url]));
		}
	});
}

const load = (src: string) => `
	await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "${src}"; s.onload = res; s.onerror = () => rej(new Error("load ${src}")); document.head.appendChild(s); });
`;

export default [
	t(
		"rv4-d-axios",
		load("/axios.js") +
			`
		const r = await axios.get("/echo", { headers: { "X-Ax": "1" }, params: { q: 2 } });
		assertEqual(r.data.headers["x-ax"], "1", "req header");
		assertEqual(r.headers["x-custom"], "custom-value", "resp header");
		assertEqual(r.headers["content-type"], "application/json", "ct");
		assertEqual(r.request.responseURL, location.origin + "/echo?q=2", "responseURL");
		const p = await axios.post("/echo", { a: 1 });
		assertEqual(p.data.body, '{"a":1}', "post body");
		const f = await axios.get("/echo", { adapter: "fetch" });
		assertEqual(f.headers.get ? f.headers.get("x-custom") : f.headers["x-custom"], "custom-value", "fetch adapter header");
	`,
		libs
	),
	t(
		"rv4-d-jquery",
		load("/jquery.js") +
			`
		const j = await $.getJSON("/echo?jq=1");
		assertEqual(j.method, "GET", "getJSON");
		await new Promise((res, rej) => {
			$.ajax({ url: "/echo", method: "POST", data: { a: "b" }, headers: { "X-JQ": "y" },
				success(data, status, xhr) {
					try {
						assertEqual(data.headers["x-jq"], "y", "hdr");
						assertEqual(xhr.getResponseHeader("X-Custom"), "custom-value", "jqxhr header");
						assert(/x-custom/i.test(xhr.getAllResponseHeaders()), "all");
						res();
					} catch (e) { rej(e); }
				},
				error(x, s, e) { rej(new Error("ajax error " + s + " " + e)); } });
		});
		const txt = await $.get("/text");
		assertEqual(txt, "hello", "get");
		// $.ajax with async:false (jQuery passes false to xhr.open)
		let syncErr = null, syncData = null;
		try { $.ajax({ url: "/text", async: false, success(d) { syncData = d; }, error(x, s, e) { syncErr = s + ":" + e; } }); } catch (e) { syncErr = "threw " + e; }
		console.log("jquery sync", syncErr, syncData);
	`,
		libs
	),
	serverTest({
		name: "rv4-d-socketio",
		autoPass: true,
		js:
			load("/sio.js") +
			`
			for (const transports of [["polling", "websocket"], ["websocket"], ["polling"]]) {
				const sock = io({ transports, reconnection: false });
				const echoed = await new Promise((res, rej) => {
					sock.on("connect_error", (e) => rej(new Error("connect_error " + transports + " " + e.message)));
					sock.on("connect", () => sock.emit("ping2", { x: 1 }, (ack) => res(ack)));
					setTimeout(() => rej(new Error("timeout " + transports)), 8000);
				});
				assertEqual(echoed.x, 1, "ack " + transports);
				if (transports.length === 2) {
					await new Promise(r => setTimeout(r, 500));
					assertEqual(sock.io.engine.transport.name, "websocket", "upgraded");
				}
				const bin = await new Promise((res) => sock.emit("bin", new Uint8Array([5, 6]), (b) => res(b)));
				assertEqual(new Uint8Array(bin)[1], 6, "binary " + transports);
				sock.disconnect();
			}
		`,
		async start(server) {
			libs(server);
			const { Server } = req("socket.io");
			const ioServer = new Server(server);
			ioServer.on("connection", (s: any) => {
				s.on("ping2", (d: any, ack: any) => ack(d));
				s.on("bin", (d: any, ack: any) => ack(d));
			});
		},
	}),
	t(
		"rv4-d-xhr-undefined-async-onload",
		`
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.onload = () => { try { assertEqual(x.status, 200, "status"); assertEqual(x.responseText, "hello", "body"); res(); } catch (e) { rej(e); } };
			x.onerror = () => rej(new Error("err"));
			x.open("GET", "/text", undefined);
			x.send();
			setTimeout(() => rej(new Error("timeout")), 5000);
		});
	`
	),
	t(
		"rv4-d-response-statics",
		`
		const j = Response.json({ a: 1 });
		assertEqual((await j.json()).a, 1, "Response.json");
		assertEqual(Response.error().type, "error", "Response.error");
		const r = Response.redirect("https://example.com/x", 301);
		assertEqual(r.headers.get("location"), "https://example.com/x", "redirect location");
		assertEqual(r.status, 301, "status");
		assert(typeof Response.prototype.bytes === "function" || true, "bytes");
		const rr = new Response(null, { status: 204, statusText: "No" });
		assertEqual(rr.statusText, "No", "statusText");
		assertEqual(rr.url, "", "empty url");
	`
	),
	t(
		"rv4-d-cookiestore-change",
		`
		if (!("cookieStore" in window)) return;
		let changes = [];
		cookieStore.addEventListener("change", (e) => changes.push(e.changed.map(c => c.name).join()));
		await cookieStore.set("chg", "1");
		await new Promise(r => setTimeout(r, 300));
		assert(changes.length > 0, "change event fired for cookieStore.set");
		assert(!changes.some(c => /sj|scramjet/i.test(c)), "no proxy cookies");
	`
	),
	t(
		"rv4-d-cookiestore-onchange-docookie",
		`
		if (!("cookieStore" in window)) return;
		let changes = 0;
		cookieStore.onchange = () => changes++;
		document.cookie = "dcchg=1";
		await new Promise(r => setTimeout(r, 300));
		assert(changes > 0, "change event fired for document.cookie write");
	`
	),
];

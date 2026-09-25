import { serverTest, type Test } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";

function wsCookieTest(
	name: string,
	pageHost: string,
	parent: string,
	wsHost: string
) {
	return Object.assign(
		serverTest({
			name,
			hostname: pageHost,
			cleartextHosts: [parent],
			autoPass: true,
			js: `
			await fetch("/set-cookie", { credentials: "include" });
			const got = await new Promise((res, rej) => {
				const ws = new WebSocket("wss://${wsHost}/sock");
				ws.onmessage = (e) => res(e.data);
				ws.onerror = () => rej(new Error("ws error"));
				setTimeout(() => rej(new Error("ws timeout")), 6000);
			});
			throw new Error("RESULT page=${pageHost} ws=${wsHost} handshakeCookie=" + JSON.stringify(got) + " docCookie=" + JSON.stringify(document.cookie));
		`,
			start: async (server) => {
				server.on("request", (req, res) => {
					if (res.headersSent) return;
					if ((req.url || "").startsWith("/set-cookie")) {
						res.writeHead(200, {
							"Set-Cookie": [
								`lax=1; Domain=${parent}; Path=/; SameSite=Lax`,
								`strict=1; Domain=${parent}; Path=/; SameSite=Strict`,
								`none=1; Domain=${parent}; Path=/; SameSite=None; Secure`,
							],
						});
						res.end("ok");
					}
				});
				const wss = new WebSocketServer({
					server,
				});
				wss.on("connection", (sock, req) => {
					sock.send(String(req.headers.cookie ?? ""));
				});
			},
		}),
		{
			timeoutMs: 15000,
		}
	);
}

const trusted = serverTest({
	name: "rv6-qa-ws-istrusted",
	autoPass: true,
	js: `
		const out = {};
		const ws = new WebSocket("ws://localhost:" + location.port);
		const EvT = EventTarget.prototype;
		await new Promise((res, rej) => {
			ws.addEventListener("open", (e) => { out.open = e.isTrusted; out.openWinEvent = window.event && window.event.isTrusted; ws.send("hi"); });
			ws.onmessage = function (e) { out.onmessage = e.isTrusted; out.onmessageWinEvent = window.event && window.event.isTrusted; out.sameAsWinEvent = window.event === e; };
			ws.addEventListener("message", { handleEvent(e) { out.handleEvent = e.isTrusted; } });
			EvT.addEventListener.call(ws, "message", (e) => {
				out.viaProtoCall = e.isTrusted;
				try { out.descriptorGetter = Object.getOwnPropertyDescriptor(e, "isTrusted").get.call(e); } catch (x) { out.descriptorGetter = "threw " + x.name; }
				out.ownKeys = Object.keys(e).join(",");
				out.instanceofEvent = e instanceof Event;
				out.toStringTag = Object.prototype.toString.call(e);
				res();
			});
			ws.onerror = () => rej(new Error("ws error"));
			setTimeout(() => rej(new Error("timeout " + JSON.stringify(out))), 5000);
		});
		// a listener registered via a fresh iframe realm's EventTarget.prototype.addEventListener
		const f = document.createElement("iframe"); document.body.appendChild(f);
		const ws2 = new WebSocket("ws://localhost:" + location.port);
		await new Promise((res) => { f.contentWindow.EventTarget.prototype.addEventListener.call(ws2, "open", (e) => { out.otherRealmListener = e.isTrusted; res(); }); });
		assertConsistent("istrusted", JSON.stringify(out));
		throw new Error("RESULT " + JSON.stringify(out));
	`,
	start: async (server) => {
		const wss = new WebSocketServer({
			server,
		});
		wss.on("connection", (sock) =>
			sock.on("message", (m) => sock.send(String(m)))
		);
	},
});
trusted.timeoutMs = 15000;

export default [
	trusted,
	wsCookieTest(
		"rv6-qa-ws-couk-www",
		"www.example.co.uk",
		"example.co.uk",
		"ws.example.co.uk"
	),
	wsCookieTest(
		"rv6-qa-ws-couk-apex",
		"app.example.co.uk",
		"example.co.uk",
		"ws.example.co.uk"
	),
	wsCookieTest(
		"rv6-qa-ws-com-www",
		"www.example.com",
		"example.com",
		"ws.example.com"
	),
	wsCookieTest(
		"rv6-qa-ws-com-deep-www",
		"www.shop.example.com",
		"example.com",
		"ws.example.com"
	),
] as Test[];

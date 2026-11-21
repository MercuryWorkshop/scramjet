import { serverTest, type Test } from "../testcommon.ts";
import { WebSocketServer } from "ws";

// A page and the host it talks to are the same site when they share a
// registrable domain, whatever the page's own subdomain: `www.example.co.uk`
// and `ws.example.co.uk`, `www.shop.example.com` and `ws.example.com`. Its
// SameSite=Lax/Strict cookies go along, on a WebSocket handshake and on a
// credentialed fetch alike.
function sameSiteTest(
	name: string,
	pageHost: string,
	parent: string,
	otherHost: string,
	via: "ws" | "fetch"
): Test {
	return Object.assign(
		serverTest({
			name,
			hostname: pageHost,
			cleartextHosts: [parent],
			autoPass: true,
			js: `
			await fetch("/set-cookie", { credentials: "include" });
			const got = ${
				via === "ws"
					? `await new Promise((res, rej) => {
				const ws = new WebSocket("wss://${otherHost}/sock");
				ws.onmessage = (e) => res(e.data);
				ws.onerror = () => rej(new Error("ws error"));
				setTimeout(() => rej(new Error("ws timeout")), 6000);
			})`
					: `await (await fetch("https://${otherHost}/echo", { credentials: "include" })).text()`
			};
			assertEqual(got, "lax=1; strict=1; none=1", "cookies sent to ${otherHost}");
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
					} else if ((req.url || "").startsWith("/echo")) {
						res.writeHead(200, {
							"Content-Type": "text/plain",
							"Access-Control-Allow-Origin": `https://${pageHost}`,
							"Access-Control-Allow-Credentials": "true",
						});
						res.end(String(req.headers.cookie ?? ""));
					}
				});
				const wss = new WebSocketServer({ server });
				wss.on("connection", (sock, req) => {
					sock.send(String(req.headers.cookie ?? ""));
				});
			},
		}),
		{ timeoutMs: 15000, scramjetOnly: true }
	);
}

export default [
	sameSiteTest(
		"same-site-cookies-ws-www-couk",
		"www.example.co.uk",
		"example.co.uk",
		"ws.example.co.uk",
		"ws"
	),
	sameSiteTest(
		"same-site-cookies-ws-www-deep",
		"www.shop.example.com",
		"example.com",
		"ws.example.com",
		"ws"
	),
	sameSiteTest(
		"same-site-cookies-fetch-www-couk",
		"www.example.co.uk",
		"example.co.uk",
		"api.example.co.uk",
		"fetch"
	),
];

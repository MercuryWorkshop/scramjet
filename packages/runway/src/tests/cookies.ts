import { serverTest } from "../testcommon.ts";

export default [
	serverTest({
		name: "cookies-fetch-set-cookie-race",
		autoPass: false,
		js: `
        assert(!document.cookie.includes("runway_cookie=testvalue"), "document.cookie should be empty");
		await fetch("/set-cookie");
		assert(
			document.cookie.includes("runway_cookie=testvalue"),
			"document.cookie should include value from Set-Cookie on same-origin fetch"
		);
		pass("cookie visible in document.cookie after fetch");
	`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "").split("?")[0] || "";
				if (path !== "/set-cookie") return;
				res.writeHead(200, {
					"Content-Type": "text/plain; charset=utf-8",
					"Set-Cookie": "runway_cookie=testvalue; Path=/",
				});
				res.end("ok");
			});
		},
	}),
	serverTest({
		name: "cookies-twitter",
		hostname: "x.com",
		// api.x.com is already under x.com for routing; list it when it is not a subdomain
		// of hostname (e.g. hostname "cdn.net" + cleartextHosts: ["api.other.net"]).
		cleartextHosts: ["api.x.com"],
		js: `
		await fetch("/set-cookie", { credentials: "include" });
		const check = await fetch("https://api.x.com/check", { credentials: "include" });
		assert(check.ok, "api check response ok");
		const body = await check.json();
		assert(body.ok === true, "api check rejected by server: " + (body.reason || ""));
		pass("cookies-twitter done");
		`,
		autoPass: false,
		start: async (server, _port, { fail }) => {
			// Same cookie *names* as typical x.com responses; values are non-secret fixtures.
			// `__cf_bm` uses Domain=x.com (host-only) and must not be sent on api.x.com.
			const expectedOnApi = {
				kdt: "fixture-kdt-AAAAAAAAAAAAAAAAAAAAAAAA",
				att: "",
				twid: "fixture-twid-0000000000000001",
				ct0: "fixture-ct0-00000000000000000000000000000000",
				auth_token: "fixture-auth-0000000000000000000000000000000000000001",
			};
			const allowedOnApi = new Set(Object.keys(expectedOnApi));

			const parseCookieHeader = (raw: string): Map<string, string> => {
				const out = new Map<string, string>();
				for (const part of raw.split(";")) {
					const p = part.trim();
					if (!p) continue;
					const i = p.indexOf("=");
					const name = (i === -1 ? p : p.slice(0, i)).trim();
					const val = i === -1 ? "" : p.slice(i + 1).trim();
					out.set(name, val);
				}
				return out;
			};

			const verifyApiCookieHeader = (raw: string | undefined) => {
				const jar = parseCookieHeader(raw || "");
				if (jar.has("__cf_bm")) {
					return {
						ok: false as const,
						reason:
							"__cf_bm was sent to api.x.com but Domain=x.com must not match subdomains",
					};
				}
				for (const name of jar.keys()) {
					if (!allowedOnApi.has(name)) {
						return {
							ok: false as const,
							reason: `unexpected cookie name on api.x.com: ${name}`,
						};
					}
				}
				for (const [name, want] of Object.entries(expectedOnApi)) {
					if (!jar.has(name)) {
						return { ok: false as const, reason: `missing cookie: ${name}` };
					}
					if (jar.get(name) !== want) {
						return {
							ok: false as const,
							reason: `wrong value for ${name} (expected fixture)`,
						};
					}
				}
				if (jar.size !== allowedOnApi.size) {
					return {
						ok: false as const,
						reason: `expected exactly ${allowedOnApi.size} cookies on api, got ${jar.size}`,
					};
				}
				return { ok: true as const };
			};

			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const host = (
					(req.headers.host || "").split(":")[0] || ""
				).toLowerCase();
				const path = (req.url || "").split("?")[0] || "";

				if (host === "api.x.com" && path === "/check") {
					const v = verifyApiCookieHeader(req.headers.cookie);
					if (!v.ok) {
						res.writeHead(400, {
							"Content-Type": "application/json; charset=utf-8",
						});
						res.end(JSON.stringify({ ok: false, reason: v.reason }));
						void fail(`api /check: ${v.reason}`);
						return;
					}
					res.writeHead(200, {
						"Content-Type": "application/json; charset=utf-8",
					});
					res.end(JSON.stringify({ ok: true }));
					return;
				}

				if (path !== "/set-cookie") {
					res.writeHead(404, { "Content-Type": "text/plain" });
					res.end("not found");
					return;
				}

				res.writeHead(200, {
					"Content-Type": "text/plain; charset=utf-8",
					"Set-Cookie": [
						"kdt=" +
							expectedOnApi.kdt +
							"; Max-Age=47260800; Expires=Tue, 19 Oct 2027 21:58:27 GMT; Path=/; Domain=.x.com; Secure; HTTPOnly",
						"att=; Max-Age=0; Expires=Mon, 20 Apr 2026 21:58:27 GMT; Path=/; Domain=.x.com; Secure; HTTPOnly; SameSite=None",
						"twid=" +
							expectedOnApi.twid +
							"; Max-Age=157680000; Expires=Sat, 19 Apr 2031 21:58:27 GMT; Path=/; Domain=.x.com; Secure; SameSite=None",
						"ct0=" +
							expectedOnApi.ct0 +
							"; Max-Age=21600; Expires=Tue, 21 Apr 2026 03:58:27 GMT; Path=/; Domain=.x.com; Secure",
						"auth_token=" +
							expectedOnApi.auth_token +
							"; Max-Age=157680000; Expires=Sat, 19 Apr 2031 21:58:27 GMT; Path=/; Domain=.x.com; Secure; HTTPOnly; SameSite=None",
						"__cf_bm=fixturecf.dummysig000000000000000000000000000000000000000000000000000000; HttpOnly; Secure; Path=/; Domain=x.com; Max-Age=1800",
					],
				});
				res.end("ok");
			});
		},
	}),
	serverTest({
		name: "cookies-img-set-cookie-race",
		autoPass: false,
		js: `
        assert(!document.cookie.includes("runway_cookie=testvalue"), "document.cookie should be empty");
        
        let img = new Image();
        img.src = "/set-cookie";
        
        document.body.appendChild(img);
        await new Promise(resolve => img.onerror= resolve);

		assert(
			document.cookie.includes("runway_cookie=testvalue"),
			"document.cookie should include value from Set-Cookie on same-origin fetch"
		);
		pass("cookie visible in document.cookie after fetch");
	`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "").split("?")[0] || "";
				if (path !== "/set-cookie") return;
				res.writeHead(200, {
					"Content-Type": "text/plain; charset=utf-8",
					"Set-Cookie": "runway_cookie=testvalue; Path=/",
				});
				res.end("ok");
			});
		},
	}),
];

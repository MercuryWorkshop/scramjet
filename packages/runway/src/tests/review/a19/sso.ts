import { serverTest } from "../../../testcommon.ts";

// rv19: login flows across a popup, subdomains and Domain cookies. Fake
// hostnames, so scramjet-only; expected values are Chrome's documented rules.

export default [
	serverTest({
		name: "rv19-sso-popup-and-subdomains",
		hostname: "www.site.example",
		cleartextHosts: ["site.example", "other.example"],
		autoPass: true,
		js: `
			const out = {};
			sessionStorage.setItem("oauth_state", "st123");
			localStorage.setItem("pkce", "ver456");
			// OAuth popup: other.example login -> redirect back to www.site.example/cb
			const msg = new Promise((res) => { addEventListener("message", (e) => { if (e.data && e.data.cb) res(e.data); }); setTimeout(() => res("timeout"), 8000); });
			const w = window.open("https://auth.other.example/login", "_blank", "width=400,height=400");
			const m = await msg;
			out.popup = m;
			out.openerCookieNow = document.cookie.split("; ").sort().join("; ");
			const me = await (await fetch("/me", { credentials: "include" })).text();
			out.meCookieHeader = me.split("; ").sort().join("; ");
			// subdomain iframe (app.site.example) sees the Domain cookie, not the host-only one
			document.cookie = "hostonly=1; path=/";
			document.cookie = "dom=1; domain=site.example; path=/";
			const f = document.createElement("iframe"); f.src = "https://app.site.example/frame"; document.body.appendChild(f);
			const fm = await new Promise((res) => { addEventListener("message", (e) => { if (e.data && e.data.frame) res(e.data); }); setTimeout(() => res("timeout"), 5000); });
			out.frame = fm;
			// cross-subdomain fetch carries Domain cookies, incl. Lax ones (same-site)
			const api = await (await fetch("https://api.site.example/echo", { credentials: "include" })).text();
			out.apiCookieHeader = api.split("; ").sort().join("; ");
			const chk = {
				popupSs: m.ss === "st123",
				popupLs: m.ls === "ver456",
				popupOwnCookie: String(m.cookie).includes("sess=abc") && String(m.cookie).includes("lax=1"),
				openerSeesLogin: out.openerCookieNow.includes("sess=abc"),
				meSent: out.meCookieHeader.includes("sess=abc"),
				idpNotSent: !out.meCookieHeader.includes("idp="),
				appSeesDomain: String(fm.cookie).includes("dom=1") && String(fm.cookie).includes("sess=abc"),
				appNoHostOnly: !String(fm.cookie).includes("hostonly"),
				appOwnLs: fm.ls === null,
				apiGetsDomainLax: out.apiCookieHeader.includes("sess=abc") && out.apiCookieHeader.includes("dom=1") && out.apiCookieHeader.includes("lax=1"),
			};
			const bad = Object.keys(chk).filter((k) => !chk[k]);
			if (bad.length) fail("FAILED " + bad.join(",") + " :: " + JSON.stringify(out));

		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const host = (req.headers.host || "").split(":")[0];
				const path = (req.url || "/").split("?")[0];
				if (
					host === "www.site.example" &&
					(path === "/" || path === "/script.js")
				)
					return;
				if (host === "auth.other.example" && path === "/login") {
					res.writeHead(302, {
						Location: "https://www.site.example/cb?code=xyz",
						"Set-Cookie": "idp=1; Path=/; Secure; SameSite=None",
					});
					res.end();
					return;
				}
				if (host === "www.site.example" && path === "/cb") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Set-Cookie": [
							"sess=abc; Path=/; Domain=site.example; Secure; SameSite=Lax",
							"lax=1; Path=/; Domain=site.example; SameSite=Lax",
						],
					});
					res.end(`<!doctype html><script>
						opener.postMessage({ cb: true, cookie: document.cookie, ss: sessionStorage.getItem("oauth_state"), ls: localStorage.getItem("pkce") }, "*");
						setTimeout(() => close(), 100);
					</script>`);
					return;
				}
				if (host === "www.site.example" && path === "/me") {
					res.writeHead(200);
					res.end(req.headers.cookie || "");
					return;
				}
				if (host === "app.site.example" && path === "/frame") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						`<!doctype html><script>parent.postMessage({ frame: true, cookie: document.cookie, ls: localStorage.getItem("pkce") }, "*");</script>`
					);
					return;
				}
				if (host === "api.site.example" && path === "/echo") {
					res.writeHead(200, {
						"Access-Control-Allow-Origin": "https://www.site.example",
						"Access-Control-Allow-Credentials": "true",
					});
					res.end(req.headers.cookie || "");
					return;
				}
				res.writeHead(404);
				res.end("nf " + host + path);
			});
		},
	}),
];

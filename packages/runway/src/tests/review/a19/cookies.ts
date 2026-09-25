import { serverTest } from "../../../testcommon.ts";

// rv19: cookie jar semantics against bare Chrome (localhost, so bare runs too).

const route = (
	server: any,
	fn: (req: any, res: any, path: string) => boolean
) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		if (fn(req, res, path)) return;
		res.writeHead(404);
		res.end("nf");
	});

export default [
	serverTest({
		name: "rv19-cookie-docookie-semantics",
		autoPass: true,
		js: `
			const out = {};
			const clear = () => { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) { document.cookie = n + "=; max-age=0; path=/"; document.cookie = n + "=; max-age=0"; } } };
			const snap = () => document.cookie.split("; ").filter(Boolean).sort().join("; ");
			clear();
			const tries = {
				plain: "a=1",
				pathSub: "psub=1; path=/sub",
				hostNoSecure: "__Host-h1=1; path=/",
				hostSecure: "__Host-h2=1; Secure; path=/",
				hostDomain: "__Host-h3=1; Secure; path=/; domain=localhost",
				hostPath: "__Host-h4=1; Secure; path=/x",
				secureNoSecure: "__Secure-s1=1",
				secureOk: "__Secure-s2=1; Secure",
				sameSiteNoneNoSecure: "ssn=1; SameSite=None",
				sameSiteNoneSecure: "sss=1; SameSite=None; Secure",
				partitioned: "part=1; Secure; Partitioned; SameSite=None; path=/",
				partNoSecure: "part2=1; Partitioned",
				expired: "exp=1; expires=Thu, 01 Jan 1970 00:00:00 GMT",
				maxAge0: "ma0=1; max-age=0",
				maxAgeNeg: "man=1; max-age=-1",
				future: "fut=1; expires=Fri, 01 Jan 2100 00:00:00 GMT",
				domainOther: "dom=1; domain=example.com",
				domainDot: "dd=1; domain=.localhost",
				emptyName: "=novalue",
				noEq: "justvalue",
				spaceName: " sp = 1 ",
				quoted: 'q="a b"',
				comma: "cm=a,b",
				json: 'js={"a":1,"b":[2,3]}',
				unicode: "uni=\\u00e9\\u4e2d",
				httponlyFromJs: "ho=1; HttpOnly",
			};
			for (const [k, v] of Object.entries(tries)) {
				const before = snap();
				document.cookie = v;
				const after = snap();
				out[k] = after === before ? "(no change)" : after.split("; ").filter((x) => !before.split("; ").includes(x)).join("; ") || "(changed:" + after + ")";
			}
			out.final = snap();
			// overwrite and delete
			document.cookie = "a=2"; out.overwrite = snap().includes("a=2") && !snap().includes("a=1");
			document.cookie = "a=; max-age=0"; out.deleted = !/(^|; )a=/.test(snap());
			// many cookies
			for (let i = 0; i < 200; i++) document.cookie = "m" + i + "=" + i;
			out.manyCount = snap().split("; ").filter((x) => /^m\\d+=/.test(x)).length;
			out.manyFirst = /(^|; )m0=0/.test(snap());
			for (let i = 0; i < 200; i++) document.cookie = "m" + i + "=; max-age=0";
			// order: longer path first
			document.cookie = "ord=root; path=/";
			document.cookie = "ord=deep; path=/";
			out.order = snap().split("; ").filter((x) => x.startsWith("ord=")).join(",");
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
			clear();
		`,
		start: async () => {},
	}),
	serverTest({
		name: "rv19-cookie-server-and-redirect",
		autoPass: true,
		js: `
			const out = {};
			const snap = () => document.cookie.split("; ").filter(Boolean).sort().join("; ");
			await fetch("/setc");
			out.afterFetch = snap();
			await fetch("/redir1");
			out.afterRedirect = snap();
			const echo = await (await fetch("/echo")).text();
			out.echo = echo.split("; ").filter(Boolean).sort().join("; ");
			const echoSub = await (await fetch("/sub/echo")).text();
			out.echoSub = echoSub.split("; ").filter(Boolean).sort().join("; ");
			// navigation redirect in an iframe
			const f = document.createElement("iframe"); f.src = "/navredir"; document.body.appendChild(f);
			await new Promise((r) => { f.onload = r; setTimeout(r, 4000); });
			out.afterNavRedirect = snap();
			out.frameUrl = f.contentWindow.location.pathname;
			if (typeof cookieStore !== "undefined") {
				out.csAll = (await cookieStore.getAll()).map((c) => c.name + "=" + c.value + "|" + c.path + "|" + c.domain + "|" + c.secure + "|" + c.sameSite + "|" + (c.expires ? "exp" : "noexp")).sort();
			}
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
		`,
		start: async (server) =>
			route(server, (req, res, path) => {
				if (path === "/setc") {
					res.writeHead(200, {
						"Set-Cookie": [
							"srv=1; Path=/",
							"srvho=1; HttpOnly; Path=/",
							"srvsub=1; Path=/sub",
							"srvexp=1; Max-Age=0",
							"srvlax=1; SameSite=Lax; Path=/",
							"srvstrict=1; SameSite=Strict; Path=/",
						],
					});
					res.end("ok");
					return true;
				}
				if (path === "/redir1") {
					res.writeHead(302, {
						Location: "/redir2",
						"Set-Cookie": "r1=1; Path=/",
					});
					res.end();
					return true;
				}
				if (path === "/redir2") {
					res.writeHead(200, {
						"Set-Cookie": "r2=1; Path=/",
					});
					res.end("ok");
					return true;
				}
				if (path === "/navredir") {
					res.writeHead(302, {
						Location: "/landed",
						"Set-Cookie": "nr=1; Path=/",
					});
					res.end();
					return true;
				}
				if (path === "/landed") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Set-Cookie": "nl=1; Path=/",
					});
					res.end("<p>landed</p>");
					return true;
				}
				if (path === "/echo" || path === "/sub/echo") {
					res.writeHead(200);
					res.end(req.headers.cookie || "");
					return true;
				}
				return false;
			}),
	}),
	serverTest({
		name: "rv19-cookie-cookiestore-semantics",
		autoPass: true,
		js: `
			const out = {};
			const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = "ERR:" + e.name; } };
			const snap = () => document.cookie.split("; ").filter(Boolean).sort().join("; ");
			await t("set2", async () => { await cookieStore.set("c1", "v1"); return snap(); });
			await t("get", async () => { const c = await cookieStore.get("c1"); return c && [c.name, c.value, c.domain, c.path, c.secure, c.sameSite, c.expires, c.partitioned].join("|"); });
			await t("setDict", async () => { await cookieStore.set({ name: "c2", value: "v2", path: "/", expires: Date.now() + 86400000 }); const c = await cookieStore.get("c2"); return c && typeof c.expires + ":" + (c.expires > Date.now()); });
			await t("setPath", async () => { await cookieStore.set({ name: "c3", value: "v3", path: "/sub" }); return [(await cookieStore.getAll()).map((c) => c.name).sort().join(","), snap()]; });
			await t("getUrl", async () => (await cookieStore.getAll({ url: location.href })).map((c) => c.name).sort().join(","));
			await t("getUrlOther", async () => (await cookieStore.getAll({ url: location.origin + "/sub/x" })).map((c) => c.name).sort().join(","));
			await t("getUrlXo", async () => (await cookieStore.getAll({ url: "https://example.com/" })).length);
			await t("docCookieVisible", async () => { document.cookie = "dc=1; path=/"; return !!(await cookieStore.get("dc")); });
			await t("docCookieAttrs", async () => { const c = await cookieStore.get("dc"); return c && [c.domain, c.path, c.secure, c.sameSite, c.expires].join("|"); });
			await t("delete", async () => { await cookieStore.delete("c1"); return [!!(await cookieStore.get("c1")), snap()]; });
			await t("deletePath", async () => { await cookieStore.delete({ name: "c3", path: "/sub" }); return (await cookieStore.getAll()).map((c) => c.name).sort().join(","); });
			await t("setComma", async () => { await cookieStore.set("cm", "a,b"); const c = await cookieStore.get("cm"); return c && c.value; });
			await t("setSpaceVal", async () => { await cookieStore.set("sp", "a b"); const c = await cookieStore.get("sp"); return c && c.value; });
			await t("setEqVal", async () => { await cookieStore.set("eq", "a=b"); const c = await cookieStore.get("eq"); return c && c.value; });
			await t("setJson", async () => { await cookieStore.set("js", '{"a":1,"b":2}'); const c = await cookieStore.get("js"); return c && c.value; });
			await t("setDomainLocal", async () => { await cookieStore.set({ name: "dl", value: "1", domain: "localhost" }); const c = await cookieStore.get("dl"); return c && c.domain; });
			await t("setExpiredPast", async () => { await cookieStore.set({ name: "ep", value: "1", expires: Date.now() - 1000 }); return !!(await cookieStore.get("ep")); });
			await t("setHost", async () => { await cookieStore.set("__Host-x", "1"); return !!(await cookieStore.get("__Host-x")); });
			await t("getAllOrder", async () => { await cookieStore.set({ name: "o", value: "root", path: "/" }); return (await cookieStore.getAll("o")).map((c) => c.value).join(","); });
			await t("afterFetch", async () => { await cookieStore.set("fx", "1"); return (await (await fetch("/echo")).text()).includes("fx=1"); });
			await t("sameSiteDefault", async () => { await cookieStore.set({ name: "ssd", value: "1" }); const c = await cookieStore.get("ssd"); return c.sameSite; });
			await t("httpOnlyHidden", async () => { await fetch("/sethttponly"); return [!!(await cookieStore.get("hon")), snap().includes("hon")]; });
			await t("overwriteHttpOnlyFromJs", async () => { document.cookie = "hon=js; path=/"; return (await (await fetch("/echo")).text()); });
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
		`,
		start: async (server) =>
			route(server, (req, res, path) => {
				if (path === "/echo") {
					res.writeHead(200);
					res.end(req.headers.cookie || "");
					return true;
				}
				if (path === "/sethttponly") {
					res.writeHead(200, {
						"Set-Cookie": "hon=1; HttpOnly; Path=/",
					});
					res.end("ok");
					return true;
				}
				return false;
			}),
	}),
	serverTest({
		name: "rv19-cookie-cookiestore-deep",
		autoPass: true,
		js: `
			history.replaceState(null, "", "/deep/dir/page.html");
			const out = {};
			const t = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = "ERR:" + e.name + ":" + e.message; } };
			const snap = () => document.cookie.split("; ").filter(Boolean).sort().join("; ");
			const all = async () => (await cookieStore.getAll()).map((c) => c.name + "=" + c.value + "@" + c.path).join(",");
			await t("docDefaultPath", async () => { document.cookie = "dp=1"; const c = await cookieStore.get("dp"); return c && c.path; });
			await t("deleteDefaultPathViaCS", async () => { await cookieStore.delete("dp"); return snap(); });
			await t("dateExpires", async () => { await cookieStore.set({ name: "de", value: "1", expires: new Date(Date.now() + 3600e3) }); const c = await cookieStore.get("de"); return c && typeof c.expires; });
			await t("sameSiteNone", async () => { await cookieStore.set({ name: "sn", value: "1", sameSite: "none" }); const c = await cookieStore.get("sn"); return c && c.sameSite; });
			await t("sameSiteLax", async () => { await cookieStore.set({ name: "sl", value: "1", sameSite: "lax" }); const c = await cookieStore.get("sl"); return c && c.sameSite; });
			await t("pathDir", async () => { await cookieStore.set({ name: "pd", value: "1", path: "/deep" }); const c = await cookieStore.get("pd"); return c && c.path; });
			await t("pathDirSlash", async () => { await cookieStore.set({ name: "pds", value: "1", path: "/deep/" }); const c = await cookieStore.get("pds"); return c && c.path; });
			await t("orderPaths", async () => { document.cookie = "o=root; path=/"; document.cookie = "o=deep; path=/deep/dir"; return (await cookieStore.getAll("o")).map((c) => c.value + "@" + c.path).join(","); });
			await t("docOrder", () => snap().split("; ").filter((x) => x.startsWith("o=")).join(","));
			await t("emptyNameSet", async () => { await cookieStore.set("", "bare"); return snap().includes("bare"); });
			await t("emptyNameGet", async () => { const c = await cookieStore.get(""); return c && c.value; });
			await t("nameWithSpace", async () => { await cookieStore.set("a b", "1"); const c = await cookieStore.get("a b"); return c && c.value; });
			await t("valueLeadingSpace", async () => { await cookieStore.set("lsp", " x "); const c = await cookieStore.get("lsp"); return c && JSON.stringify(c.value); });
			await t("urlOption", async () => (await cookieStore.getAll({ url: location.pathname })).length > 0);
			await t("maxLen", async () => { await cookieStore.set("big", "x".repeat(4090)); return !!(await cookieStore.get("big")); });
			await t("tooBig", async () => { await cookieStore.set("big2", "x".repeat(5000)); return !!(await cookieStore.get("big2")); });
			await t("final", all);
			for (const k of Object.keys(out)) assertConsistent(k, out[k]);
		`,
		start: async () => {},
	}),
	serverTest({
		name: "rv19-cookie-default-path-after-pushstate",
		autoPass: true,
		js: `
			history.pushState(null, "", "/dashboard/settings");
			document.cookie = "theme=dark";
			const echo = await (await fetch("/echo")).text();
			const out = { sentToRoot: echo.includes("theme=dark"), visibleHere: document.cookie.includes("theme=dark") };
			history.pushState(null, "", "/");
			out.visibleAtRoot = document.cookie.includes("theme=dark");
			assertConsistent("defaultpath", out);
		`,
		start: async (server) =>
			route(server, (req, res, path) => {
				if (path === "/echo") {
					res.writeHead(200);
					res.end(req.headers.cookie || "");
					return true;
				}
				return false;
			}),
	}),
];

import { serverTest } from "../../testcommon.ts";

// The navigations a site actually performs: submitting a form, following a
// link, opening a popup. These are driven from the page and verified on the
// server, so the assertion is what the origin really received - a login form
// that posts to the wrong URL or drops its body is the kind of break that makes
// a site unusable rather than merely wrong.

export default [
	serverTest({
		name: "navigation-form-get",
		autoPass: false,
		js: `
			const f = document.createElement("form");
			f.method = "GET";
			f.action = "/submitted";
			f.innerHTML = '<input name="a" value="1"><input name="b" value="two">';
			document.body.appendChild(f);
			f.submit();
		`,
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path !== "/submitted") {
					res.writeHead(404);
					res.end();
					return;
				}
				const q = (req.url || "").split("?")[1] || "";
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end("ok");
				if (req.method !== "GET") return fail("method was " + req.method);
				if (q === "a=1&b=two") pass("the GET form query arrived intact");
				else fail("query was " + JSON.stringify(q));
			});
		},
	}),
	serverTest({
		name: "navigation-form-post",
		autoPass: false,
		js: `
			const f = document.createElement("form");
			f.method = "POST";
			f.action = "/submitted";
			f.innerHTML = '<input name="a" value="1"><input name="b" value="two">';
			document.body.appendChild(f);
			f.submit();
		`,
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path !== "/submitted") {
					res.writeHead(404);
					res.end();
					return;
				}
				const chunks: Buffer[] = [];
				req.on("data", (c) => chunks.push(c));
				req.on("end", () => {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("ok");
					const body = Buffer.concat(chunks).toString();
					const ct = String(req.headers["content-type"] || "");
					if (req.method !== "POST") return fail("method was " + req.method);
					if (!ct.includes("application/x-www-form-urlencoded"))
						return fail("content-type was " + ct);
					if (body === "a=1&b=two") pass("the POST form body arrived intact");
					else fail("body was " + JSON.stringify(body));
				});
			});
		},
	}),
	serverTest({
		name: "navigation-form-post-multipart",
		autoPass: false,
		js: `
			const f = document.createElement("form");
			f.method = "POST";
			f.action = "/submitted";
			f.enctype = "multipart/form-data";
			f.innerHTML = '<input name="a" value="1">';
			document.body.appendChild(f);
			f.submit();
		`,
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path !== "/submitted") {
					res.writeHead(404);
					res.end();
					return;
				}
				const chunks: Buffer[] = [];
				req.on("data", (c) => chunks.push(c));
				req.on("end", () => {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end("ok");
					const body = Buffer.concat(chunks).toString();
					const ct = String(req.headers["content-type"] || "");
					if (!ct.startsWith("multipart/form-data; boundary="))
						return fail("content-type was " + ct);
					if (body.includes('name="a"') && body.includes("1"))
						pass("the multipart form body arrived");
					else fail("body was " + JSON.stringify(body));
				});
			});
		},
	}),
	serverTest({
		name: "navigation-link-click",
		autoPass: false,
		js: `
			const a = document.createElement("a");
			a.href = "/clicked?x=1";
			a.textContent = "go";
			document.body.appendChild(a);
			a.click();
		`,
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path !== "/clicked") {
					res.writeHead(404);
					res.end();
					return;
				}
				const q = (req.url || "").split("?")[1] || "";
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end("ok");
				if (q === "x=1") pass("the link click navigated with the query intact");
				else fail("query was " + JSON.stringify(q));
			});
		},
	}),
	serverTest({
		name: "navigation-popup-opener-postmessage",
		autoPass: false,
		js: `
			// the OAuth popup shape: open a window, have it message the opener back
			const w = window.open("/popup.html", "adversarialpopup");
			assert(w, "window.open returned a window");
			const msg = await new Promise((res, rej) => {
				window.addEventListener("message", (e) => res(e.data));
				setTimeout(() => rej(new Error("no message arrived from the popup")), 6000);
			});
			assertEqual(msg.from, "popup", "the message came from the popup: " + JSON.stringify(msg));
			assertEqual(msg.href, location.origin + "/popup.html", "the popup's own location.href");
			assertEqual(msg.hasOpener, true, "the popup can reach window.opener");
			assert(!String(msg.href).includes("/~/sj/"), "the popup must not see a proxy URL");
			w.close();
			pass();
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path !== "/popup.html") {
					res.writeHead(404);
					res.end();
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(
					"<!DOCTYPE html><html><body><script>" +
						"opener.postMessage({from:'popup',href:location.href,hasOpener:!!window.opener},'*');" +
						"</" +
						"script></body></html>"
				);
			});
		},
	}),
];

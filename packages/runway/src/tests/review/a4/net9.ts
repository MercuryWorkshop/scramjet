import { t } from "./net.ts";
/* eslint-disable quotes */
const u8 = (s: string) => Buffer.from(s, "utf8").toString("latin1");
const extra = (server: any) => {
	server.on("request", (req: any, res: any) => {
		if (req.url === "/u8redirect") {
			res.writeHead(302, {
				Location: u8("/echo?ü=é"),
			});
			res.end();
		} else if (req.url === "/u8csp") {
			res.writeHead(200, {
				"Content-Type": "text/plain",
				"Content-Security-Policy": u8("default-src 'self'; report-uri /ré"),
				"X-Frame-Options": "DENY",
			});
			res.end("csp");
		} else if (req.url === "/u8link") {
			res.writeHead(200, {
				"Content-Type": "text/plain",
				Link: u8("</ünï>; rel=preload; as=image"),
			});
			res.end("link");
		} else if (req.url === "/u8disp") {
			res.writeHead(200, {
				"Content-Type": "text/plain",
				"Content-Disposition": u8('attachment; filename="résumé.txt"'),
			});
			res.end("disp");
		}
	});
};
const to = (p: string) =>
	`await Promise.race([${p}, new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 5000))])`;
export default [
	t(
		"rv4-i-u8-redirect",
		`
		const r = ${to('fetch("/u8redirect")')};
		assert(r.ok, "followed");
		assert(r.url.includes("/echo?"), "url " + r.url);
	`,
		extra
	),
	t(
		"rv4-i-u8-csp",
		`
		const r = ${to('fetch("/u8csp")')};
		assertEqual(await r.text(), "csp", "body");
	`,
		extra
	),
	t(
		"rv4-i-u8-link",
		`
		const r = ${to('fetch("/u8link")')};
		assertEqual(await r.text(), "link", "body");
		console.log(r.headers.get("link"));
	`,
		extra
	),
	t(
		"rv4-i-u8-disposition",
		`
		const r = ${to('fetch("/u8disp")')};
		assertEqual(await r.text(), "disp", "body");
	`,
		extra
	),
	t(
		"rv4-i-u8-iframe-nav",
		`
		const f = document.createElement("iframe");
		f.src = "/u8redirect";
		document.body.appendChild(f);
		await new Promise(r => { f.onload = r; setTimeout(r, 4000); });
		const txt = f.contentDocument && f.contentDocument.body ? f.contentDocument.body.textContent : "";
		assert(txt.includes("GET"), "iframe followed utf8 redirect: " + txt.slice(0, 100));
	`,
		extra
	),
];

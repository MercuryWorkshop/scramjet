import { hdrTest } from "./nonce.ts";

const js = `
runTest(async () => {
	const out = {};
	const r = await fetch("/res.txt");
	const norm = a => a.filter(([k]) => !["date", "connection", "keep-alive", "transfer-encoding"].includes(k));
	out.entries = norm([...r.headers]);
	const fe = []; r.headers.forEach((v, k) => fe.push([k, v])); out.forEach = norm(fe);
	out.fromEntries = Object.keys(Object.fromEntries(r.headers)).filter(k => k.includes("scramjet")).length;
	out.hasCarrier = [r.headers.has("x-scramjet-content-type"), r.headers.get("x-scramjet-x-a"), r.headers.get("x-scramjet-Link")];
	out.setCookie = r.headers.getSetCookie();
	out.copy = norm([...new Headers(r.headers)]);
	out.clone = norm([...r.clone().headers]);
	const nr = new Response("b", { headers: r.headers }); out.newResp = norm([...nr.headers]);
	const req = new Request("/x", { headers: r.headers }); out.newReq = [...req.headers].map(([k]) => k).filter(k => k.includes("scramjet"));
	const c = await caches.open("t"); await c.put("/res.txt", r.clone()); const m = await c.match("/res.txt"); out.cached = norm([...m.headers]);
	const x = new XMLHttpRequest(); x.open("GET", "/res.txt"); await new Promise(res => { x.onload = res; x.send(); });
	out.xhrCarrier = [x.getResponseHeader("x-scramjet-x-a"), /scramjet/i.test(x.getAllResponseHeaders())];
	out.link = r.headers.get("link").replace(/:\\d+/g, ":P");
	out.dup = r.headers.get("x-dup");
	out.redirect = await (async () => { const rr = await fetch("/res.txt?redir"); return [rr.url.replace(/:\\d+/, ":P"), rr.headers.get("x-a")]; })();
	
	assertConsistent("carriers", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

export default [
	hdrTest({
		name: "rv25-carriers",
		routes: {
			"/": {
				body: `<!DOCTYPE html><script>${js}</script>`,
			},
			"/res.txt": {
				body: "hi",
				type: "text/plain",
				headers: {
					"x-a": "1",
					link: "</style.css>; rel=preload; as=style",
					"set-cookie": "a=b",
					"x-dup": "1",
					"content-language": "en",
				},
			},
		},
	}),
];

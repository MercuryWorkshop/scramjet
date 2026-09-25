import { serverTest } from "../../../testcommon.ts";

// Relative Request/fetch/XHR URLs from srcdoc and about:blank children.

function server(s: any) {
	s.on("request", (req: any, res: any) => {
		if (req.url === "/" || req.url === "/script.js") return;
		res.writeHead(200, {
			"content-type": "application/json",
		});
		res.end(
			JSON.stringify({
				path: req.url,
			})
		);
	});
}

const OPS = `
	const K = async (k, f) => {
		let v;
		try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
		if (v === undefined) v = "undefined";
		if (typeof v === "string") v = v.split(parent.location.origin).join("O");
		parent.assertConsistent(PFX + k, v);
	};
	await K("reqUrl", () => new Request("/echo?a").url);
	await K("reqUrlRel", () => new Request("echo?b").url);
	await K("reqFetch", async () => (async () => { const rr = await fetch(new Request("/echo?c")); try { return (await rr.json()).path; } catch (e) { return "nonjson " + rr.status; } })());
	await K("fetchStr", async () => (async () => { const rr = await fetch("/echo?d"); try { return (await rr.json()).path; } catch (e) { return "nonjson " + rr.status; } })());
	await K("fetchUrlObj", async () => (async () => { const rr = await fetch(new URL("/echo?e", document.baseURI)); try { return (await rr.json()).path; } catch (e) { return "nonjson " + rr.status; } })());
	await K("xhr", () => new Promise(r => { const x = new XMLHttpRequest(); x.open("GET", "/echo?f"); x.onload = () => { try { r(JSON.parse(x.responseText).path); } catch (e) { r("nonjson " + x.status); } }; x.onerror = () => r("err"); x.send(); }));
	await K("baseURI", () => document.baseURI);
	await K("aHref", () => { const a = document.createElement("a"); a.href = "/echo?g"; return a.href; });
	await K("respUrl", async () => (await fetch("/echo?h")).url);
	await K("reqClone", () => new Request("/echo?i").clone().url);
	await K("reqFromReq", () => new Request(new Request("/echo?j")).url);
`;

export default [
	serverTest({
		name: "rv17-srcdoc-requests",
		autoPass: true,
		start: async (s) => server(s),
		js: `
			const run = (setup, pfx) => new Promise((res) => {
				const f = document.createElement("iframe");
				window["__done_" + pfx] = res;
				setup(f, "<script>(async () => { const PFX = " + JSON.stringify(pfx + ".") + "; " + ${JSON.stringify(OPS)} + "; parent.__done_" + pfx + "(); })()<\\/script>");
				if (!f.isConnected) document.body.append(f);
				setTimeout(res, 8000);
			});
			await run((f, s) => { f.srcdoc = s; }, "srcdoc");
			await run((f, s) => { f.addEventListener("load", () => {}); document.body.append(f); const d = f.contentDocument; d.open(); d.write(s); d.close(); }, "docwrite");
		`,
	}),
];

import { serverTest } from "../../../testcommon.ts";

// rv19: a document's own Set-Cookie must be visible to its inline scripts.
// Popups whose return value the opener never touches.

const serve = (server: any) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const u = new URL(req.url, "http://x");
		const path = u.pathname;
		if (path === "/" || path === "/script.js") return;
		if (path === "/doc") {
			const id = u.searchParams.get("id");
			res.writeHead(200, {
				"Content-Type": "text/html",
				"Set-Cookie": `ck_${id}=1; Path=/`,
			});
			res.end(`<!doctype html><script>
				const msg = { id: ${JSON.stringify(id)}, cookie: document.cookie.includes("ck_${id}=1"), hasOpener: !!window.opener };
				fetch("/report", { method: "POST", body: JSON.stringify(msg) });
				setTimeout(() => { try { close(); } catch {} }, 200);
			</script>`);
			return;
		}
		if (path === "/redir") {
			const id = u.searchParams.get("id");
			res.writeHead(302, {
				Location: "/doc?id=" + id,
				"Set-Cookie": `rd_${id}=1; Path=/`,
			});
			res.end();
			return;
		}
		if (path === "/report") {
			let b = "";
			req.on("data", (c: any) => (b += c));
			req.on("end", () => {
				(server as any).__rep = (server as any).__rep || [];
				(server as any).__rep.push(JSON.parse(b));
				res.end("ok");
			});
			return;
		}
		if (path === "/reports") {
			res.writeHead(200, {
				"Content-Type": "application/json",
			});
			res.end(JSON.stringify((server as any).__rep || []));
			return;
		}
	});

export default [
	serverTest({
		name: "rv19-popupcookie-own-set-cookie",
		autoPass: true,
		js: `
			window.open("/doc?id=popup");
			window.open("/doc?id=noopener", "_blank", "noopener");
			window.open("/redir?id=popupredir");
			const f = document.createElement("iframe"); f.src = "/doc?id=frame"; document.body.appendChild(f);
			const a = document.createElement("a"); a.href = "/doc?id=anchorblank"; a.target = "_blank"; document.body.appendChild(a); a.click();
			let rep = [];
			for (let i = 0; i < 40 && rep.length < 5; i++) { await new Promise((r) => setTimeout(r, 200)); rep = await (await fetch("/reports")).json(); }
			const out = {};
			for (const r of rep) out[r.id] = r.cookie;
			for (const k of ["popup", "noopener", "popupredir", "frame", "anchorblank"]) assertConsistent(k, out[k] ?? "missing");
			const bad = ["popup", "noopener", "popupredir", "frame", "anchorblank"].filter((k) => out[k] !== true);
			if (bad.length) fail("these documents do not see their own Set-Cookie: " + JSON.stringify(out));
		`,
		start: async (server) => serve(server),
	}),
];

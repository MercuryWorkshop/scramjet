import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const S = (f) => {
	try {
		const v = f();
		return typeof v === "string" ? v : JSON.stringify(v);
	} catch (e) {
		return "throws:" + e.name;
	}
};
const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;

export default [
	// OAuth-style: popup hops site -> idp (P0) -> idp2 (P1) -> back to site /cb, which posts to opener
	withOrigins(
		"rv21-popup-oauth-hops",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const got = [];
		addEventListener("message", (e) => got.push(e));
		const w = window.open(P[0] + "/auth?back=" + encodeURIComponent(location.origin + "/cb"), "rv21oauth", "width=400,height=400");
		const e = await waitMsg((x) => x.data && x.data.code, 10000);
		R.got = S(() => !!e);
		R.origin = S(() => e.origin === location.origin);
		R.source = S(() => e.source === w);
		R.data = S(() => e.data);
		R.idpMsgs = S(() => got.filter((x) => x.data && x.data.idp).map((x) => [x.data.idp, x.origin === P[0] || x.origin === P[1], x.source === w]));
		const closed = await waitMsg((x) => x.data && x.data.bye, 3000);
		R.byeOnUnload = S(() => closed ? [closed.data.bye, closed.origin === location.origin, closed.source === w] : "none");
		await new Promise((r) => setTimeout(r, 300));
		R.closed = S(() => w.closed);
		${report}
	`,
		(mp, ports) => ({
			"/auth": [
				H,
				`<!doctype html><body><script>opener.postMessage({ idp: "p0" }, "*"); setTimeout(() => location.href = "http://localhost:${ports[1]}/auth2" + location.search, 200);</script></body>`,
			],
			"/auth2": [
				H,
				`<!doctype html><body><script>opener.postMessage({ idp: "p1" }, "*"); setTimeout(() => location.replace(new URLSearchParams(location.search).get("back") + "?code=xyz"), 200);</script></body>`,
			],
		}),
		{
			n: 2,
			timeoutMs: 30000,
			mainFiles: () => ({
				"/cb": [
					H,
					`<!doctype html><body><script src="/cb.js"></script></body>`,
				],
				"/cb.js": [
					J,
					`
			addEventListener("pagehide", () => { try { opener.postMessage({ bye: "pagehide" }, location.origin); } catch (e) {} });
			opener.postMessage({ code: new URLSearchParams(location.search).get("code") }, location.origin);
			setTimeout(() => window.close(), 300);
		`,
				],
			}),
		}
	),
	// iframe posting to parent during unload/pagehide/beforeunload when parent navigates it away
	withOrigins(
		"rv21-unload-messages",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const f = document.createElement("iframe"); f.src = P[0] + "/u";
		const rdy = waitMsg((e) => e.data === "ready", 6000);
		document.body.appendChild(f); await rdy;
		const got = [];
		const h = (e) => { if (e.data && e.data.ev) got.push([e.data.ev, e.origin === P[0], e.source === f.contentWindow]); };
		addEventListener("message", h);
		f.src = P[0] + "/next";
		await waitMsg((e) => e.data === "next", 6000);
		await new Promise((r) => setTimeout(r, 300));
		R.unloadMsgs = S(() => got.sort());
		// removal
		const f2 = document.createElement("iframe"); f2.src = P[0] + "/u";
		const rdy2 = waitMsg((e) => e.data === "ready", 6000);
		document.body.appendChild(f2); await rdy2;
		got.length = 0;
		f2.remove();
		await new Promise((r) => setTimeout(r, 500));
		R.removeMsgs = S(() => got.map((g) => [g[0], g[1]]).sort());
		${report}
	`,
		() => ({
			"/u": [H, `<!doctype html><body><script src="/u.js"></script></body>`],
			"/u.js": [
				J,
				`
			for (const ev of ["beforeunload", "pagehide", "unload", "visibilitychange"]) addEventListener(ev, () => parent.postMessage({ ev }, "*"));
			parent.postMessage("ready", "*");
		`,
			],
			"/next": [
				H,
				`<!doctype html><script>parent.postMessage("next", "*")</script>`,
			],
		})
	),
] as Test[];

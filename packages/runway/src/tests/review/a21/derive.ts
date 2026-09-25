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

// Child-side ways of computing the parent's origin, and parent-side ways of computing the child's, each used as targetOrigin.
export default [
	withOrigins(
		"rv21-derive-targetorigin",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		await new Promise((r) => { const sc = document.createElement("script"); sc.src = P[0] + "/widget.js"; sc.onload = r; document.head.appendChild(sc); });
		const got = {};
		addEventListener("message", (e) => { if (e.data && e.data.via) got[e.data.via] = (e.origin === P[0]); });
		const f = document.createElement("iframe"); f.src = P[0] + "/child"; f.name = "rv21child";
		const rdy = waitMsg((e) => e.data === "ready", 6000);
		document.body.appendChild(f); await rdy;
		// wait for child's derived posts
		await new Promise((r) => setTimeout(r, 1200));
		for (const k of Object.keys(got).sort()) R["c2p_" + k] = String(got[k]);
		R.c2p_seen = Object.keys(got).sort().join(",");
		// parent -> child, computing child's origin
		const s = document.querySelector("script[src*='widget']");
		const a = document.createElement("a"); a.href = f.src;
		const cands = {
			iframeSrc: () => f.src,
			iframeSrcOrigin: () => new URL(f.src).origin,
			iframeGetAttr: () => f.getAttribute("src"),
			anchorOrigin: () => a.origin,
			anchorProtoHost: () => a.protocol + "//" + a.host,
			scriptSrcOrigin: () => new URL(s.src).origin,
			perfEntry: () => new URL(performance.getEntriesByType("resource").find((x) => x.name.includes("/widget.js")).name).origin,
			navEntry: () => new URL(performance.getEntriesByType("navigation")[0].name).origin === location.origin ? P[0] : "bad",
		};
		for (const [k, fn] of Object.entries(cands)) {
			let to;
			try { to = fn(); } catch (e) { R["p2c_" + k] = "derive-throws:" + e.name; continue; }
			const p = waitMsg((e) => e.data && e.data.ack === k, 1200);
			try { f.contentWindow.postMessage({ ping: k }, to); } catch (e) { R["p2c_" + k] = "post-throws:" + e.name; continue; }
			const e = await p;
			R["p2c_" + k] = e ? "ok" : "DROPPED";
		}
		${report}
	`,
		(mp, ports) => ({
			"/child": [
				H,
				`<!doctype html><body><script src="/child.js"></script></body>`,
			],
			"/widget.js": [J, `/* widget */`],
			"/child.js": [
				J,
				`
			const cur = document.currentScript;
			addEventListener("message", (e) => { if (e.data && e.data.ping) parent.postMessage({ ack: e.data.ping }, "*"); });
			const a = document.createElement("a"); a.href = document.referrer;
			const cands = {
				referrer: () => document.referrer,
				referrerOrigin: () => new URL(document.referrer).origin,
				anchorReferrer: () => a.protocol + "//" + a.host,
				ancestorOrigins: () => location.ancestorOrigins[0],
				ancestorOriginsGuarded: () => (location.ancestorOrigins && location.ancestorOrigins.length) ? location.ancestorOrigins[0] : document.referrer,
				currentScriptOwn: () => "http://localhost:${mp}",
			};
			for (const [k, fn] of Object.entries(cands)) {
				try { parent.postMessage({ via: k }, fn()); } catch (e) { parent.postMessage({ via: k + "_throws_" + e.name }, "*"); }
			}
			parent.postMessage("ready", "*");
		`,
			],
		}),
		{
			mainFiles: (mp, ports) => ({}),
		}
	),
	// about:blank / srcdoc / document.write children posting with their own location-derived origins
	withOrigins(
		"rv21-derive-blank-self",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const code = \`
			const out = { origin: location.origin, selfOrigin: self.origin, href: location.href };
			for (const [k, to] of [["locOrigin", location.origin], ["selfOrigin", self.origin], ["parentLocOrigin", parent.location.origin], ["slash", "/"], ["docURL", document.URL]]) {
				try { parent.postMessage({ blank: k, kind: KIND }, to); } catch (e) { parent.postMessage({ blank: k + "_throws_" + e.name, kind: KIND }, "*"); }
			}
			parent.postMessage({ blankinfo: out, kind: KIND }, "*");
		\`;
		const got = {};
		addEventListener("message", (e) => { if (e.data && e.data.blank) (got[e.data.kind] ||= []).push(e.data.blank); if (e.data && e.data.blankinfo) R["info_" + e.data.kind] = JSON.stringify([e.data.blankinfo.origin === location.origin, e.data.blankinfo.selfOrigin === location.origin, e.data.blankinfo.href]); });
		const f1 = document.createElement("iframe"); document.body.appendChild(f1);
		f1.contentWindow.eval("const KIND='blank';" + code);
		const f2 = document.createElement("iframe"); f2.srcdoc = "<script>const KIND='srcdoc';" + code + "<\/script>"; document.body.appendChild(f2);
		const f3 = document.createElement("iframe"); document.body.appendChild(f3);
		f3.contentDocument.open(); f3.contentDocument.write("<script>const KIND='written';" + code + "<\/script>"); f3.contentDocument.close();
		await new Promise((r) => setTimeout(r, 1500));
		for (const k of Object.keys(got).sort()) R["got_" + k] = got[k].sort().join(",");
		${report}
	`,
		() => ({})
	),
] as Test[];
